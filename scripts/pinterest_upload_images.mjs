#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadEnvFile,
  parseArgs,
  readJson,
  resolveQueuePath,
  writeJson,
  writeText,
} from "./pinterest/lib/common.mjs";
import {
  assertCdnConfig,
  createS3Client,
  getCdnConfig,
  isPlaceholderPublicUrl,
  uploadLocalFile,
} from "./pinterest/lib/cdn-client.mjs";

loadEnvFile(path.resolve(".env"));

export async function runUploadImages(options = {}) {
  const queueDir = path.resolve(options.queueDir || "content-queue");
  const configPath = path.resolve(options.config || resolveQueuePath(queueDir, "config.json"));
  const manifestPath = path.resolve(options.manifest || resolveQueuePath(queueDir, "manifest.json"));
  const dryRun = options.dryRun === true;
  const force = options.force === true;
  const statusFilter = options.status || "draft";
  const limit = options.limit ? Number(options.limit) : Infinity;
  const singlePinId = options.pinId || "";

  const startedAt = new Date().toISOString();
  const result = {
    startedAt,
    status: "失敗",
    dryRun,
    uploaded: [],
    skipped: [],
    errors: [],
    diagnostics: [],
    cdn: null,
  };

  try {
    if (!fs.existsSync(configPath)) {
      throw new Error(`config.json が見つかりません: ${configPath}`);
    }
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`manifest.json がありません: ${manifestPath}`);
    }

    const queueConfig = readJson(configPath);
    const manifest = readJson(manifestPath);
    const cdn = getCdnConfig(queueConfig);
    result.cdn = { provider: cdn.provider, bucket: cdn.bucket, prefix: cdn.prefix };

    if (!dryRun) {
      assertCdnConfig(cdn);
    }

    const client = dryRun ? null : await createS3Client(cdn);

    let processed = 0;
    const pins = singlePinId
      ? [readJson(resolveQueuePath(queueDir, "pins", `${singlePinId}.json`))]
      : (manifest.pins || []);

    for (const pin of pins) {
      if (processed >= limit) break;
      if (!pin?.id) continue;
      if (!singlePinId && statusFilter && pin.status !== statusFilter) {
        result.skipped.push(`${pin.id}: status=${pin.status}`);
        continue;
      }

      const imagePath = resolveQueuePath(
        queueDir,
        pin.image?.localPath || path.join("images", `${pin.id}.png`),
      );
      if (!fs.existsSync(imagePath)) {
        result.skipped.push(`${pin.id}: local image missing`);
        continue;
      }

      const existingKey = pin.image?.cdn?.key;
      const existingUrl = pin.image?.publicUrl || "";
      if (!force && existingKey && !isPlaceholderPublicUrl(existingUrl)) {
        result.skipped.push(`${pin.id}: already uploaded`);
        continue;
      }

      const fileName = pin.image?.fileName || path.basename(imagePath);

      if (dryRun) {
        result.uploaded.push(`${pin.id}: dry-run -> ${fileName}`);
        processed += 1;
        continue;
      }

      try {
        const uploaded = await uploadLocalFile(client, cdn, imagePath, fileName);
        pin.image = pin.image || {};
        pin.image.publicUrl = uploaded.publicUrl;
        pin.image.cdn = {
          provider: cdn.provider,
          bucket: cdn.bucket,
          key: uploaded.key,
          etag: uploaded.etag,
          size: uploaded.size,
          uploadedAt: new Date().toISOString(),
        };
        pin.lastError = "";
        updatePinFiles(queueDir, manifestPath, manifest, pin);
        result.uploaded.push(`${pin.id}: ${uploaded.publicUrl}`);
        processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        pin.lastError = message;
        updatePinFiles(queueDir, manifestPath, manifest, pin);
        result.errors.push(`${pin.id}: ${message}`);
      }
    }

    result.status = result.errors.length
      ? (result.uploaded.length ? "部分失敗" : "失敗")
      : "成功";
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  writeUploadResult(queueDir, result);
  return result;
}

function updatePinFiles(queueDir, manifestFile, manifest, pin) {
  writeJson(resolveQueuePath(queueDir, "pins", `${pin.id}.json`), pin);
  const index = (manifest.pins || []).findIndex((item) => item.id === pin.id);
  if (index >= 0) manifest.pins[index] = pin;
  writeJson(manifestFile, manifest);
}

function writeUploadResult(queueDir, result) {
  const resultPath = resolveQueuePath(queueDir, "cdn-upload-result.md");
  const finishedAt = new Date().toISOString();
  const cdnInfo = result.cdn
    ? `provider=${result.cdn.provider}, bucket=${result.cdn.bucket || "(未設定)"}, prefix=${result.cdn.prefix}`
    : "なし";

  const lines = [
    "# CDN Upload Result",
    "",
    `- 判定: ${result.status}`,
    `- dry-run: ${result.dryRun}`,
    `- 開始: ${result.startedAt}`,
    `- 終了: ${finishedAt}`,
    "",
    "## アップロード",
    ...(result.uploaded.length ? result.uploaded.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## スキップ",
    ...(result.skipped.length ? result.skipped.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## エラー",
    ...(result.errors.length ? result.errors.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## 診断",
    `- CDN: ${cdnInfo}`,
    ...(result.diagnostics.length ? result.diagnostics.map((item) => `- ${item}`) : []),
    "",
  ];
  writeText(resultPath, `${lines.join("\n")}\n`);
  console.log(`cdn upload result: ${resultPath}`);
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || args.h) {
      console.log(`使い方:
  node scripts/pinterest_upload_images.mjs

オプション:
  --queue-dir DIR         既定: content-queue
  --config FILE           既定: content-queue/config.json
  --manifest FILE         既定: content-queue/manifest.json
  --status draft|posted   対象ステータス（既定: draft）
  --pin-id ID             1件だけアップロード
  --limit N               最大件数
  --force true            既アップロード済みも再アップロード
  --dry-run true|false    既定: false
`);
      process.exit(0);
    }

    runUploadImages({
      queueDir: args["queue-dir"] || "content-queue",
      config: args.config,
      manifest: args.manifest,
      status: args.status || "draft",
      pinId: args["pin-id"] || "",
      limit: args.limit ? Number(args.limit) : undefined,
      force: args.force === "true",
      dryRun: args["dry-run"] === "true",
    }).then((result) => {
      if (result.status === "失敗") process.exitCode = 1;
    });
}
