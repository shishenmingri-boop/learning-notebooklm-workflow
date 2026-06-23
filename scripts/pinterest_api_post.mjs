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
  buildPinPayload,
  createPin,
  getPinterestConfig,
  getValidAccessToken,
  listBoards,
  loadToken,
  resolveBoardId,
  runOAuthCallbackServer,
} from "./pinterest/lib/pinterest-client.mjs";

loadEnvFile(path.resolve(".env"));

const args = parseArgs(process.argv.slice(2));
const action = args.action || "help";
const queueDir = path.resolve(args["queue-dir"] || "content-queue");
const configPath = path.resolve(args.config || resolveQueuePath(queueDir, "config.json"));
const manifestPath = path.resolve(args.manifest || resolveQueuePath(queueDir, "manifest.json"));
const resultPath = resolveQueuePath(queueDir, "post-result.md");
const dryRun = args["dry-run"] !== "false";
const sandbox = args.sandbox === "true" || process.env.PINTEREST_SANDBOX === "true";

const result = {
  startedAt: new Date().toISOString(),
  action,
  status: "失敗",
  dryRun,
  sandbox,
  posted: [],
  skipped: [],
  errors: [],
  diagnostics: [],
};

try {
  if (action === "help" || args.help || args.h) {
    printHelp();
    process.exit(0);
  }

  switch (action) {
    case "auth": {
      const pinterestConfig = getPinterestConfig({ sandbox });
      await actionAuth(pinterestConfig);
      result.status = "成功";
      break;
    }
    case "status": {
      const pinterestConfig = getPinterestConfig({ sandbox });
      actionStatus(pinterestConfig);
      result.status = "成功";
      break;
    }
    case "boards": {
      const pinterestConfig = getPinterestConfig({ sandbox });
      await actionBoards(pinterestConfig);
      result.status = "成功";
      break;
    }
    case "post-queue":
      await actionPostQueue({ sandbox });
      result.status = result.errors.length ? "部分失敗" : "成功";
      break;
    case "post-pin":
      await actionPostPin({ sandbox }, args["pin-id"]);
      result.status = result.errors.length ? "失敗" : "成功";
      break;
    default:
      throw new Error(`未知の action: ${action}`);
  }
} catch (error) {
  result.errors.push(error instanceof Error ? error.message : String(error));
}

writePostResult();
if (result.status === "失敗") process.exitCode = 1;

function printHelp() {
  console.log(`使い方:
  node scripts/pinterest_api_post.mjs --action auth
  node scripts/pinterest_api_post.mjs --action boards
  node scripts/pinterest_api_post.mjs --action post-queue --dry-run true
  node scripts/pinterest_api_post.mjs --action post-pin --pin-id kitchen-narrow-01 --dry-run false

オプション:
  --action auth|status|boards|post-queue|post-pin
  --queue-dir DIR              既定: content-queue
  --config FILE                既定: content-queue/config.json
  --manifest FILE              既定: content-queue/manifest.json
  --dry-run true|false         既定: true
  --sandbox true|false         既定: false
  --pin-id ID                  post-pin 用
  --status posted|draft|failed 投稿対象フィルタ
  --limit N                    最大投稿数

環境変数:
  PINTEREST_APP_ID
  PINTEREST_APP_SECRET
  PINTEREST_REDIRECT_URI       既定: http://localhost:8765/callback
  PINTEREST_TOKEN_PATH         既定: .pinterest-oauth-token.json
  PINTEREST_SANDBOX            true で sandbox API
`);
}

async function actionAuth(config) {
  const existing = loadToken(config.tokenPath);
  if (existing?.access_token) {
    result.diagnostics.push(`既存トークンあり: ${config.tokenPath}`);
  }
  const { authUrl, token } = await runOAuthCallbackServer(config);
  result.diagnostics.push(`Authorization URL: ${authUrl}`);
  result.diagnostics.push(`Token saved: ${config.tokenPath}`);
  result.diagnostics.push(`Scopes: ${token.scope || ""}`);
}

function actionStatus(config) {
  const token = loadToken(config.tokenPath);
  if (!token) {
    console.log("トークン未保存");
    return;
  }
  console.log(JSON.stringify({
    tokenPath: config.tokenPath,
    scope: token.scope,
    expires_at: token.expires_at,
    saved_at: token.saved_at,
    sandbox: config.sandbox,
  }, null, 2));
}

async function actionBoards(config) {
  const accessToken = await getValidAccessToken(config);
  const boards = await listBoards(config, accessToken);
  const simplified = boards.map((board) => ({ id: board.id, name: board.name }));
  const outputPath = resolveQueuePath(queueDir, "boards.json");
  writeJson(outputPath, { fetchedAt: new Date().toISOString(), boards: simplified });
  console.log(`boards saved: ${outputPath}`);
  simplified.forEach((board) => console.log(`- ${board.name}: ${board.id}`));

  if (fs.existsSync(configPath)) {
    const queueConfig = readJson(configPath);
    queueConfig.boardIds = Object.fromEntries(
      Object.entries(queueConfig.boardNames || {}).map(([cluster, boardName]) => {
        const match = simplified.find((board) => board.name === boardName);
        return [cluster, match?.id || ""];
      }),
    );
    writeJson(configPath, queueConfig);
    result.diagnostics.push(`config.json の boardIds を更新: ${configPath}`);
  }
}

async function actionPostQueue(options) {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json がありません。先に pipeline を実行してください: ${manifestPath}`);
  }

  const queueConfig = fs.existsSync(configPath) ? readJson(configPath) : {};
  const manifest = readJson(manifestPath);
  const pinterestConfig = dryRun ? null : getPinterestConfig(options);
  const accessToken = dryRun ? "" : await getValidAccessToken(pinterestConfig);
  const boards = dryRun ? [] : await listBoards(pinterestConfig, accessToken);
  const statusFilter = args.status || "draft";
  const limit = args.limit ? Number(args.limit) : Infinity;

  let processed = 0;
  for (const pin of manifest.pins || []) {
    if (processed >= limit) break;
    if (statusFilter && pin.status !== statusFilter) {
      result.skipped.push(`${pin.id}: status=${pin.status}`);
      continue;
    }

    try {
      validatePinReady(pin, queueConfig, { dryRun });
      const boardId = dryRun
        ? `[dry-run:${pin.board}]`
        : resolveBoardId(boards, pin.board, buildBoardMap(queueConfig));
      const payload = dryRun
        ? {
            board_id: boardId,
            title: pin.title,
            description: pin.description,
            link: pin.link,
            media_source: { source_type: "image_url", url: pin.image?.publicUrl || "" },
          }
        : buildPinPayload(pin, boardId);

      if (dryRun) {
        result.posted.push(`${pin.id}: dry-run`);
        result.diagnostics.push(`DRY RUN ${pin.id} -> board ${pin.board} image ${pin.image?.publicUrl}`);
      } else {
        const created = await createPin(pinterestConfig, accessToken, payload);
        pin.status = "posted";
        pin.postedPinId = created.id || "";
        pin.postedAt = new Date().toISOString();
        pin.lastError = "";
        updatePinFile(pin);
        result.posted.push(`${pin.id}: ${created.id || "created"}`);
      }
      processed += 1;
    } catch (error) {
      pin.status = "failed";
      pin.lastError = error instanceof Error ? error.message : String(error);
      updatePinFile(pin);
      result.errors.push(`${pin.id}: ${pin.lastError}`);
    }
  }

  writeJson(manifestPath, manifest);
}

async function actionPostPin(options, pinId) {
  if (!pinId) throw new Error("--pin-id が必要です。");
  const pinPath = resolveQueuePath(queueDir, "pins", `${pinId}.json`);
  if (!fs.existsSync(pinPath)) throw new Error(`pin が見つかりません: ${pinPath}`);

  const queueConfig = fs.existsSync(configPath) ? readJson(configPath) : {};
  const pin = readJson(pinPath);
  validatePinReady(pin, queueConfig, { dryRun });

  if (dryRun) {
    result.posted.push(`${pin.id}: dry-run`);
    result.diagnostics.push(`DRY RUN ${pin.id}`);
    return;
  }

  const pinterestConfig = getPinterestConfig(options);
  const accessToken = await getValidAccessToken(pinterestConfig);
  const boards = await listBoards(pinterestConfig, accessToken);
  const boardId = resolveBoardId(boards, pin.board, buildBoardMap(queueConfig));
  const created = await createPin(pinterestConfig, accessToken, buildPinPayload(pin, boardId));
  pin.status = "posted";
  pin.postedPinId = created.id || "";
  pin.postedAt = new Date().toISOString();
  pin.lastError = "";
  writeJson(pinPath, pin);
  result.posted.push(`${pin.id}: ${created.id || "created"}`);
}

function buildBoardMap(queueConfig) {
  const map = {};
  for (const [cluster, boardName] of Object.entries(queueConfig.boardNames || {})) {
    const boardId = queueConfig.boardIds?.[cluster];
    if (boardId) map[boardName] = boardId;
  }
  return map;
}

function validatePinReady(pin, queueConfig, options = {}) {
  const { dryRun = false } = options;
  if (!pin.title || !pin.description || !pin.link) {
    throw new Error("title/description/link が不足しています");
  }
  const imageUrl = pin.image?.publicUrl;
  if (!imageUrl) {
    throw new Error("image.publicUrl が未設定です");
  }
  if (!dryRun) {
    if (imageUrl.includes("your-cdn.example.com")) {
      throw new Error("image.publicUrl が未設定です。config.json の imagePublicBaseUrl と画像配置を確認してください");
    }
    if (queueConfig.imagePublicBaseUrl?.includes("your-cdn.example.com")) {
      throw new Error("config.json の imagePublicBaseUrl を更新してください");
    }
  }
  if (!pin.board) {
    throw new Error("board が未設定です");
  }
}

function updatePinFile(pin) {
  const pinPath = resolveQueuePath(queueDir, "pins", `${pin.id}.json`);
  writeJson(pinPath, pin);
}

function writePostResult() {
  ensureDir(path.dirname(resultPath));
  const finishedAt = new Date().toISOString();
  const lines = [
    "# Pinterest Post Result",
    "",
    `- 判定: ${result.status}`,
    `- action: ${result.action}`,
    `- dry-run: ${result.dryRun}`,
    `- sandbox: ${result.sandbox}`,
    `- 開始: ${result.startedAt}`,
    `- 終了: ${finishedAt}`,
    "",
    "## 投稿 / dry-run",
    ...(result.posted.length ? result.posted.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## スキップ",
    ...(result.skipped.length ? result.skipped.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## エラー",
    ...(result.errors.length ? result.errors.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## 診断",
    ...(result.diagnostics.length ? result.diagnostics.map((item) => `- ${item}`) : ["- なし"]),
    "",
  ];
  writeText(resultPath, `${lines.join("\n")}\n`);
  console.log(`post result: ${resultPath}`);
}
