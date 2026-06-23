#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
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
`);
  process.exit(0);
}

const queueDir = path.resolve(args["queue-dir"] || "content-queue");
const configPath = path.resolve(args.config || resolveQueuePath(queueDir, "config.json"));
const manifestPath = path.resolve(args.manifest || resolveQueuePath(queueDir, "manifest.json"));
const dryRun = args["dry-run"] === "true";
const force = args.force === "true";
const statusFilter = args.status || "draft";
const limit = args.limit ? Number(args.limit) : Infinity;
const singlePinId = args["pin-id"] || "";

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

  for (const pin of pins) {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pin.lastError = message;
      updatePinFiles(queueDir, manifestPath, manifest, pin);
      result.errors.push(`${pin.id}: ${message}`);
    }
  }

  result.status = result.errors.length ? (result.generated.length ? "部分失敗" : "失敗") : "成功";
} catch (error) {
  result.errors.push(error instanceof Error ? error.message : String(error));
}

writeImageResult();
if (result.status === "失敗") process.exitCode = 1;

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

function writeImageResult() {
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
