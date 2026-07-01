#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureDir,
  loadEnvFile,
  parseArgs,
  readJson,
  resolveQueuePath,
  writeJson,
  writeText,
} from "./pinterest/lib/common.mjs";
import {
  downloadImage,
  generateFluxImage,
  getFluxConfig,
} from "./pinterest/lib/flux-client.mjs";
import {
  buildFluxNegativePrompt,
  buildFluxPrompt,
} from "./pinterest/lib/prompt-builder.mjs";

loadEnvFile(path.resolve(".env"));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runGenerateImages(options = {}) {
  const queueDir = path.resolve(options.queueDir || "content-queue");
  const configPath = path.resolve(options.config || resolveQueuePath(queueDir, "config.json"));
  const manifestPath = path.resolve(options.manifest || resolveQueuePath(queueDir, "manifest.json"));
  const dryRun = options.dryRun === true;
  const force = options.force === true;
  const statusFilter = options.status || "draft";
  const limit = options.limit ? Number(options.limit) : Infinity;
  const singlePinId = options.pinId || "";
  const sleepSec = options.sleepSec ?? 12;
  const retryCount = options.retryCount ?? 2;

  const startedAt = new Date().toISOString();
  const result = {
    startedAt,
    status: "失敗",
    dryRun,
    generated: [],
    skipped: [],
    errors: [],
    diagnostics: [],
  };

  try {
    if (!fs.existsSync(configPath)) {
      throw new Error(`config.json が見つかりません: ${configPath}`);
    }
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`manifest.json がありません。先に pipeline を実行してください: ${manifestPath}`);
    }

    const queueConfig = readJson(configPath);
    const manifest = readJson(manifestPath);
    const fluxConfig = getFluxConfig(queueConfig);
    const imagesDir = resolveQueuePath(queueDir, "images");
    ensureDir(imagesDir);

    let processed = 0;
    const pins = singlePinId
      ? [readJson(resolveQueuePath(queueDir, "pins", `${singlePinId}.json`))]
      : (manifest.pins || []);

    for (let pinIndex = 0; pinIndex < pins.length; pinIndex += 1) {
      const pin = pins[pinIndex];
      if (processed >= limit) break;
      if (!pin?.id) continue;
      if (!singlePinId && statusFilter && pin.status !== statusFilter) {
        result.skipped.push(`${pin.id}: status=${pin.status}`);
        continue;
      }

      const imagePath = resolveQueuePath(queueDir, pin.image?.localPath || path.join("images", `${pin.id}.png`));
      if (!force && fs.existsSync(imagePath)) {
        result.skipped.push(`${pin.id}: image exists`);
        continue;
      }

      const prompt = buildFluxPrompt(pin, queueConfig);
      const negativePrompt = buildFluxNegativePrompt(queueConfig);

      if (dryRun) {
        result.generated.push(`${pin.id}: dry-run`);
        result.diagnostics.push(`PROMPT ${pin.id}: ${prompt}`);
        processed += 1;
        continue;
      }

      let success = false;
      let lastError = null;

      for (let attempt = 0; attempt <= retryCount; attempt += 1) {
        try {
          const generated = await generateFluxImage({ prompt, negativePrompt, fluxConfig });
          await downloadImage(generated.outputUrl, imagePath);

          pin.image = pin.image || {};
          pin.image.localPath = path.relative(queueDir, imagePath).replace(/\\/g, "/");
          pin.image.fileName = path.basename(imagePath);
          pin.image.publicUrl = joinPublicUrl(queueConfig.imagePublicBaseUrl, pin.image.fileName);
          pin.image.flux = {
            model: generated.model,
            predictionId: generated.predictionId,
            prompt,
            negativePrompt,
            generatedAt: new Date().toISOString(),
          };
          if (pin.status === "failed") pin.status = "draft";
          pin.lastError = "";

          updatePinFiles(queueDir, manifestPath, manifest, pin);
          result.generated.push(`${pin.id}: ${path.relative(process.cwd(), imagePath)}`);
          processed += 1;
          success = true;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (attempt < retryCount) {
            result.diagnostics.push(`${pin.id}: retry ${attempt + 1}/${retryCount} (${lastError.message})`);
            await sleep(2000);
          }
        }
      }

      if (!success && lastError) {
        pin.lastError = lastError.message;
        updatePinFiles(queueDir, manifestPath, manifest, pin);
        result.errors.push(`${pin.id}: ${lastError.message}`);
      }

      if (!singlePinId && !dryRun && sleepSec > 0 && (success || lastError)) {
        await sleep(sleepSec * 1000);
      }
    }

    result.status = result.errors.length ? (result.generated.length ? "部分失敗" : "失敗") : "成功";
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  writeImageResult(queueDir, result);
  return result;
}

function joinPublicUrl(base, fileName) {
  if (!base || !fileName) return "";
  return `${String(base).replace(/\/+$/, "")}/${String(fileName).replace(/^\/+/, "")}`;
}

function updatePinFiles(queueDir, manifestFile, manifest, pin) {
  writeJson(resolveQueuePath(queueDir, "pins", `${pin.id}.json`), pin);
  const index = (manifest.pins || []).findIndex((item) => item.id === pin.id);
  if (index >= 0) manifest.pins[index] = pin;
  writeJson(manifestFile, manifest);
}

function writeImageResult(queueDir, result) {
  const resultPath = resolveQueuePath(queueDir, "image-generation-result.md");
  const finishedAt = new Date().toISOString();
  const lines = [
    "# Flux Image Generation Result",
    "",
    `- 判定: ${result.status}`,
    `- dry-run: ${result.dryRun}`,
    `- 開始: ${result.startedAt}`,
    `- 終了: ${finishedAt}`,
    "",
    "## 生成",
    ...(result.generated.length ? result.generated.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## スキップ",
    ...(result.skipped.length ? result.skipped.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## エラー",
    ...(result.errors.length ? result.errors.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## プロンプト / 診断",
    ...(result.diagnostics.length ? result.diagnostics.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## 次のアクション",
    "1. 生成 PNG を CDN にアップロードし `image.publicUrl` が公開 URL になることを確認",
    "2. `npm run pinterest:post:dry-run`",
    "3. `npm run pinterest:post`",
    "",
  ];
  writeText(resultPath, `${lines.join("\n")}\n`);
  console.log(`image generation result: ${resultPath}`);
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log(`使い方:
  node scripts/pinterest_generate_images.mjs

オプション:
  --queue-dir DIR         既定: content-queue
  --config FILE           既定: content-queue/config.json
  --manifest FILE         既定: content-queue/manifest.json
  --status draft|failed   対象ステータス（既定: draft）
  --pin-id ID             1件だけ生成
  --limit N               最大生成数
  --force true            既存画像を上書き
  --dry-run true          プロンプトだけ表示（既定: false）
  --sleep SEC             各生成後の待機秒数（既定: 12、--pin-id 時は待機なし）
  --retry N               生成失敗時の再試行回数（既定: 2）
`);
    process.exit(0);
  }

  runGenerateImages({
    queueDir: args["queue-dir"] || "content-queue",
    config: args.config,
    manifest: args.manifest,
    status: args.status || "draft",
    pinId: args["pin-id"] || "",
    limit: args.limit ? Number(args.limit) : undefined,
    force: args.force === "true",
    dryRun: args["dry-run"] === "true",
    sleepSec: args.sleep ? Number(args.sleep) : 12,
    retryCount: args.retry ? Number(args.retry) : 2,
  }).then((result) => {
    if (result.status === "失敗") process.exitCode = 1;
  });
}
