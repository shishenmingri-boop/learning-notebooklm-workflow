#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  loadEnvFile,
  parseArgs,
  readJson,
  resolveQueuePath,
  writeText,
} from "./pinterest/lib/common.mjs";
import { isPlaceholderPublicUrl } from "./pinterest/lib/cdn-client.mjs";
import { runGenerateImages } from "./pinterest_generate_images.mjs";
import { runUploadImages } from "./pinterest_upload_images.mjs";

loadEnvFile(path.resolve(".env"));

const execFileAsync = promisify(execFile);

function derivePinStage(queueDir, pin) {
  const imagePath = resolveQueuePath(
    queueDir,
    pin.image?.localPath || path.join("images", `${pin.id}.png`),
  );
  const imaged = fs.existsSync(imagePath);
  const uploaded = Boolean(pin.image?.cdn?.key) && !isPlaceholderPublicUrl(pin.image?.publicUrl || "");
  const posted = pin.status === "posted";
  return { imaged, uploaded, posted };
}

function summarizePins(queueDir, pins) {
  const summary = { total: pins.length, imaged: 0, uploaded: 0, posted: 0, needsImage: 0, needsUpload: 0, needsPost: 0 };
  for (const pin of pins) {
    const stage = derivePinStage(queueDir, pin);
    if (stage.imaged) summary.imaged += 1;
    if (stage.uploaded) summary.uploaded += 1;
    if (stage.posted) summary.posted += 1;
    if (!stage.imaged) summary.needsImage += 1;
    if (stage.imaged && !stage.uploaded) summary.needsUpload += 1;
    if (stage.uploaded && !stage.posted) summary.needsPost += 1;
  }
  return summary;
}

async function runPostStage({ queueDir, config, manifest, dryRun }) {
  const scriptPath = path.resolve("scripts/pinterest_api_post.mjs");
  const args = [
    scriptPath,
    "--action", "post-queue",
    "--queue-dir", queueDir,
    "--dry-run", dryRun ? "true" : "false",
  ];
  if (config) args.push("--config", config);
  if (manifest) args.push("--manifest", manifest);

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, args, { cwd: process.cwd() });
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    return { status: "成功", errors: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    return { status: "失敗", errors: [message] };
  }
}

export async function runPipeline(options = {}) {
  const queueDir = path.resolve(options.queueDir || "content-queue");
  const configPath = path.resolve(options.config || resolveQueuePath(queueDir, "config.json"));
  const manifestPath = path.resolve(options.manifest || resolveQueuePath(queueDir, "manifest.json"));
  const stage = options.stage || "all";
  const dryRunPost = options.dryRunPost !== false;
  const sleepSec = options.sleepSec ?? 12;

  const startedAt = new Date().toISOString();
  const result = {
    startedAt,
    stage,
    dryRunPost,
    status: "成功",
    summary: null,
    stages: {},
    errors: [],
  };

  if (!fs.existsSync(manifestPath)) {
    result.status = "失敗";
    result.errors.push(`manifest.json がありません: ${manifestPath}`);
    writePipelineResult(queueDir, result);
    return result;
  }

  const manifest = readJson(manifestPath);
  const pins = manifest.pins || [];
  result.summary = summarizePins(queueDir, pins);

  const runImages = stage === "all" || stage === "images";
  const runUpload = stage === "all" || stage === "upload";
  const runPost = stage === "all" || stage === "post";

  if (runImages && result.summary.needsImage > 0) {
    console.log(`\n=== Stage: images (${result.summary.needsImage} pins need images) ===`);
    const imageResult = await runGenerateImages({
      queueDir,
      config: configPath,
      manifest: manifestPath,
      status: "draft",
      sleepSec,
    });
    result.stages.images = {
      status: imageResult.status,
      generated: imageResult.generated.length,
      skipped: imageResult.skipped.length,
      errors: imageResult.errors,
    };
    if (imageResult.errors.length) {
      result.errors.push(...imageResult.errors.map((item) => `[images] ${item}`));
    }
  } else if (runImages) {
    result.stages.images = { status: "スキップ", generated: 0, skipped: pins.length, errors: [] };
    console.log("\n=== Stage: images (all pins already have images) ===");
  }

  const manifestAfterImages = readJson(manifestPath);
  result.summary = summarizePins(queueDir, manifestAfterImages.pins || []);

  if (runUpload && result.summary.needsUpload > 0) {
    console.log(`\n=== Stage: upload (${result.summary.needsUpload} pins need upload) ===`);
    const uploadResult = await runUploadImages({
      queueDir,
      config: configPath,
      manifest: manifestPath,
      status: "draft",
      dryRun: false,
    });
    result.stages.upload = {
      status: uploadResult.status,
      uploaded: uploadResult.uploaded.length,
      skipped: uploadResult.skipped.length,
      errors: uploadResult.errors,
    };
    if (uploadResult.errors.length) {
      result.errors.push(...uploadResult.errors.map((item) => `[upload] ${item}`));
    }
  } else if (runUpload) {
    result.stages.upload = { status: "スキップ", uploaded: 0, skipped: pins.length, errors: [] };
    console.log("\n=== Stage: upload (all pins already uploaded) ===");
  }

  const manifestAfterUpload = readJson(manifestPath);
  result.summary = summarizePins(queueDir, manifestAfterUpload.pins || []);

  if (runPost && result.summary.needsPost > 0) {
    console.log(`\n=== Stage: post (${result.summary.needsPost} pins ready, dry-run=${dryRunPost}) ===`);
    const postResult = await runPostStage({
      queueDir,
      config: configPath,
      manifest: manifestPath,
      dryRun: dryRunPost,
    });
    result.stages.post = postResult;
    if (postResult.errors.length) {
      result.errors.push(...postResult.errors.map((item) => `[post] ${item}`));
    }
  } else if (runPost) {
    result.stages.post = { status: "スキップ", errors: [] };
    console.log("\n=== Stage: post (no pins ready to post) ===");
  }

  const failedStages = Object.values(result.stages).filter(
    (stageResult) => stageResult.status === "失敗" || stageResult.status === "部分失敗",
  );
  if (failedStages.length || result.errors.length) {
    result.status = failedStages.length === Object.keys(result.stages).length ? "失敗" : "部分失敗";
  }

  writePipelineResult(queueDir, result);
  return result;
}

function writePipelineResult(queueDir, result) {
  const resultPath = resolveQueuePath(queueDir, "pipeline-result.md");
  const finishedAt = new Date().toISOString();
  const summary = result.summary || {};

  const stageLines = Object.entries(result.stages).map(([name, stageResult]) => {
    const details = JSON.stringify(stageResult, null, 2).split("\n").map((line) => `  ${line}`).join("\n");
    return `### ${name}\n- status: ${stageResult.status}\n${details}`;
  });

  const lines = [
    "# Pinterest Pipeline Result",
    "",
    `- 判定: ${result.status}`,
    `- stage: ${result.stage}`,
    `- post dry-run: ${result.dryRunPost}`,
    `- 開始: ${result.startedAt}`,
    `- 終了: ${finishedAt}`,
    "",
    "## ピン状態サマリ",
    `- total: ${summary.total ?? 0}`,
    `- imaged: ${summary.imaged ?? 0}`,
    `- uploaded: ${summary.uploaded ?? 0}`,
    `- posted: ${summary.posted ?? 0}`,
    `- needsImage: ${summary.needsImage ?? 0}`,
    `- needsUpload: ${summary.needsUpload ?? 0}`,
    `- needsPost: ${summary.needsPost ?? 0}`,
    "",
    "## 段階別結果",
    ...(stageLines.length ? stageLines : ["- 実行なし"]),
    "",
    "## エラー",
    ...(result.errors.length ? result.errors.map((item) => `- ${item}`) : ["- なし"]),
    "",
  ];
  writeText(resultPath, `${lines.join("\n")}\n`);
  console.log(`\npipeline result: ${resultPath}`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  console.log(`使い方:
  node scripts/pinterest_pipeline.mjs

オプション:
  --queue-dir DIR       既定: content-queue
  --config FILE         既定: content-queue/config.json
  --manifest FILE       既定: content-queue/manifest.json
  --stage all|images|upload|post   既定: all
  --dry-run true|false  post 段階の dry-run（既定: true）
  --sleep SEC           画像生成間隔秒（既定: 12）
`);
  process.exit(0);
}

runPipeline({
  queueDir: args["queue-dir"] || "content-queue",
  config: args.config,
  manifest: args.manifest,
  stage: args.stage || "all",
  dryRunPost: args["dry-run"] !== "false",
  sleepSec: args.sleep ? Number(args.sleep) : 12,
}).then((result) => {
  if (result.status === "失敗") process.exitCode = 1;
});
