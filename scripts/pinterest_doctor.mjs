#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  loadEnvFile,
  parseArgs,
  readJson,
  resolveQueuePath,
  writeText,
} from "./pinterest/lib/common.mjs";
import { getCdnConfig, isPlaceholderPublicUrl } from "./pinterest/lib/cdn-client.mjs";

loadEnvFile(path.resolve(".env"));

const PLACEHOLDER_NOTE = /your-account/i;

async function checkUrlReachable(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    let response = await fetch(url, { method: "HEAD", signal: controller.signal });
    if (response.status === 405 || response.status === 501) {
      response = await fetch(url, { method: "GET", signal: controller.signal });
    }
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function addCheck(checks, { id, label, level, message }) {
  checks.push({ id, label, level, message });
}

export async function runDoctor(options = {}) {
  const queueDir = path.resolve(options.queueDir || "content-queue");
  const configPath = path.resolve(options.config || resolveQueuePath(queueDir, "config.json"));
  const manifestPath = path.resolve(options.manifest || resolveQueuePath(queueDir, "manifest.json"));

  const checks = [];
  const startedAt = new Date().toISOString();

  if (process.env.REPLICATE_API_TOKEN) {
    addCheck(checks, { id: "replicate", label: "Replicate API", level: "OK", message: "REPLICATE_API_TOKEN が設定されています" });
  } else {
    addCheck(checks, { id: "replicate", label: "Replicate API", level: "NG", message: "REPLICATE_API_TOKEN が未設定です" });
  }

  const hasPinterestId = Boolean(process.env.PINTEREST_APP_ID);
  const hasPinterestSecret = Boolean(process.env.PINTEREST_APP_SECRET);
  if (hasPinterestId && hasPinterestSecret) {
    addCheck(checks, { id: "pinterest", label: "Pinterest API", level: "OK", message: "PINTEREST_APP_ID / PINTEREST_APP_SECRET が設定されています" });
  } else {
    addCheck(checks, { id: "pinterest", label: "Pinterest API", level: "NG", message: "PINTEREST_APP_ID または PINTEREST_APP_SECRET が未設定です" });
  }

  const hasCdnKey = Boolean(process.env.CDN_ACCESS_KEY_ID);
  const hasCdnSecret = Boolean(process.env.CDN_SECRET_ACCESS_KEY);
  const hasCdnBucket = Boolean(process.env.CDN_BUCKET);
  if (hasCdnKey && hasCdnSecret && hasCdnBucket) {
    addCheck(checks, { id: "cdn-env", label: "CDN 環境変数", level: "OK", message: "CDN_ACCESS_KEY_ID / CDN_SECRET_ACCESS_KEY / CDN_BUCKET が設定されています" });
  } else {
    addCheck(checks, { id: "cdn-env", label: "CDN 環境変数", level: "NG", message: "CDN 認証情報または CDN_BUCKET が未設定です" });
  }

  let queueConfig = {};
  if (fs.existsSync(configPath)) {
    queueConfig = readJson(configPath);
  } else {
    addCheck(checks, { id: "config", label: "config.json", level: "NG", message: `config.json が見つかりません: ${configPath}` });
  }

  const cdn = getCdnConfig(queueConfig);
  const configBucket = queueConfig.cdn?.bucket || "";
  if (process.env.CDN_BUCKET && configBucket && configBucket !== "your-bucket-name" && process.env.CDN_BUCKET !== configBucket) {
    addCheck(checks, {
      id: "cdn-bucket-mismatch",
      label: "CDN bucket 一致",
      level: "WARN",
      message: `CDN_BUCKET (${process.env.CDN_BUCKET}) と config.cdn.bucket (${configBucket}) が不一致です。.env の CDN_BUCKET を単一ソースとして使用してください`,
    });
  }

  if (process.env.CDN_ENDPOINT || queueConfig.cdn?.endpoint) {
    addCheck(checks, { id: "cdn-endpoint", label: "CDN endpoint", level: "OK", message: "CDN endpoint が設定されています" });
  } else if (cdn.provider === "r2") {
    addCheck(checks, { id: "cdn-endpoint", label: "CDN endpoint", level: "NG", message: "provider=r2 ですが CDN_ENDPOINT が未設定です" });
  }

  const imagePublicBaseUrl = queueConfig.imagePublicBaseUrl || "";
  const cdnPublicBaseUrl = queueConfig.cdn?.publicBaseUrl || "";
  if (isPlaceholderPublicUrl(imagePublicBaseUrl) && isPlaceholderPublicUrl(cdnPublicBaseUrl)) {
    addCheck(checks, {
      id: "public-url",
      label: "公開 URL",
      level: "NG",
      message: "imagePublicBaseUrl / config.cdn.publicBaseUrl がプレースホルダのままです",
    });
  } else {
    addCheck(checks, {
      id: "public-url",
      label: "公開 URL",
      level: "OK",
      message: "imagePublicBaseUrl または config.cdn.publicBaseUrl が設定されています",
    });
  }

  const noteBaseUrl = queueConfig.noteBaseUrl || "";
  if (!noteBaseUrl || PLACEHOLDER_NOTE.test(noteBaseUrl)) {
    addCheck(checks, { id: "note-url", label: "note URL", level: "NG", message: "noteBaseUrl が your-account のままです" });
  } else {
    addCheck(checks, { id: "note-url", label: "note URL", level: "OK", message: "noteBaseUrl が設定されています" });
  }

  if (fs.existsSync(manifestPath)) {
    const manifest = readJson(manifestPath);
    const firstPin = (manifest.pins || []).find((pin) => pin.image?.publicUrl);
    if (firstPin?.image?.publicUrl) {
      const url = firstPin.image.publicUrl;
      if (isPlaceholderPublicUrl(url)) {
        addCheck(checks, {
          id: "url-reach",
          label: "公開 URL 到達性",
          level: "WARN",
          message: `manifest 先頭 pin の publicUrl がプレースホルダです: ${url}`,
        });
      } else {
        const reachable = await checkUrlReachable(url);
        addCheck(checks, {
          id: "url-reach",
          label: "公開 URL 到達性",
          level: reachable ? "OK" : "WARN",
          message: reachable
            ? `HTTP 200: ${url}`
            : `到達不可または非200: ${url}`,
        });
      }
    } else {
      addCheck(checks, {
        id: "url-reach",
        label: "公開 URL 到達性",
        level: "WARN",
        message: "manifest に publicUrl 付き pin がありません（スキップ）",
      });
    }
  } else {
    addCheck(checks, {
      id: "manifest",
      label: "manifest.json",
      level: "WARN",
      message: `manifest.json が見つかりません: ${manifestPath}`,
    });
  }

  const hasNg = checks.some((check) => check.level === "NG");
  const status = hasNg ? "NG" : "OK";

  for (const check of checks) {
    console.log(`[${check.level}] ${check.label}: ${check.message}`);
  }

  writeDoctorResult(queueDir, { startedAt, status, checks });
  return { status, checks, hasNg };
}

function writeDoctorResult(queueDir, { startedAt, status, checks }) {
  const resultPath = resolveQueuePath(queueDir, "doctor-result.md");
  const finishedAt = new Date().toISOString();
  const lines = [
    "# Pinterest Doctor Result",
    "",
    `- 判定: ${status}`,
    `- 開始: ${startedAt}`,
    `- 終了: ${finishedAt}`,
    "",
    "## チェック結果",
    ...checks.map((check) => `- [${check.level}] ${check.label}: ${check.message}`),
    "",
  ];
  writeText(resultPath, `${lines.join("\n")}\n`);
  console.log(`doctor result: ${resultPath}`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  console.log(`使い方:
  node scripts/pinterest_doctor.mjs

オプション:
  --queue-dir DIR    既定: content-queue
  --config FILE      既定: content-queue/config.json
  --manifest FILE    既定: content-queue/manifest.json
`);
  process.exit(0);
}

runDoctor({
  queueDir: args["queue-dir"] || "content-queue",
  config: args.config,
  manifest: args.manifest,
}).then((result) => {
  if (result.hasNg) process.exitCode = 1;
});
