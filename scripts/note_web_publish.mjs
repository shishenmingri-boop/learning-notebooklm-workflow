#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  ensureDir,
  loadEnvFile,
  parseArgs,
  resolveQueuePath,
  writeText,
} from "./pinterest/lib/common.mjs";
import {
  fillNoteEditor,
  launchBrowser,
  loginToNote,
  openNewNoteEditor,
  saveNote,
} from "./note/lib/browser.mjs";
import { parseNoteFile } from "./note/lib/markdown.mjs";
import {
  loadState,
  markDraft,
  markFailed,
  markPublished,
  saveState,
  shouldPublish,
} from "./note/lib/publish-state.mjs";

loadEnvFile(path.resolve(".env"));

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  printHelp();
  process.exit(0);
}

const queueDir = path.resolve(args["queue-dir"] || "content-queue");
const notesDir = resolveQueuePath(queueDir, "notes");
const resultPath = resolveQueuePath(queueDir, "note-publish-result.md");
const dryRun = args["dry-run"] !== "false";
const mode = args.mode || (dryRun ? "draft" : "draft");
const noteSlug = args["note-slug"] || "";
const limit = args.limit ? Number(args.limit) : Infinity;
const force = args.force === "true";
const headless = args.headless === "true";
const browserChannel = args["browser-channel"] || "auto";
const userDataDir = path.resolve(args["user-data-dir"] || ".note-playwright-profile");

const result = {
  startedAt: new Date().toISOString(),
  status: "失敗",
  dryRun,
  mode,
  force,
  processed: [],
  skipped: [],
  errors: [],
  diagnostics: [],
  browser: {
    requestedChannel: browserChannel,
    launchedWith: "未起動",
    userDataDir,
    headless,
  },
};

let browserContext;

try {
  if (!fs.existsSync(notesDir)) {
    throw new Error(`notes ディレクトリがありません: ${notesDir}`);
  }

  const noteFiles = discoverNoteFiles(notesDir, noteSlug);
  if (noteFiles.length === 0) {
    throw new Error(noteSlug
      ? `指定 slug の note が見つかりません: ${noteSlug}`
      : `note ファイルがありません: ${notesDir}`);
  }

  const state = loadState(queueDir);
  const targets = [];

  for (const filePath of noteFiles) {
    const note = parseNoteFile(filePath);
    if (!shouldPublish(state, note.slug, mode, { force })) {
      result.skipped.push(`${note.slug}: 既に ${state.notes[note.slug]?.status || "処理済み"}`);
      continue;
    }
    targets.push({ filePath, ...note });
    if (targets.length >= limit) break;
  }

  result.diagnostics.push(`対象 note: ${targets.length}件 / 全 ${noteFiles.length}件`);

  if (dryRun) {
    for (const note of targets) {
      result.processed.push({
        slug: note.slug,
        title: note.title,
        mode,
        action: "dry-run",
        noteUrl: "",
      });
      result.diagnostics.push(`DRY RUN ${note.slug}: ${note.title} (${mode})`);
      console.log(`[dry-run] ${note.slug}: ${note.title} (${mode})`);
    }
    result.status = "成功";
  } else {
    if (targets.length === 0) {
      result.status = "成功";
      result.diagnostics.push("処理対象なし（すべてスキップ）");
    } else {
      const email = process.env.NOTE_EMAIL || "";
      const password = process.env.NOTE_PASSWORD || "";

      const launched = await launchBrowser({ userDataDir, headless, browserChannel });
      browserContext = launched.context;
      result.browser.launchedWith = launched.launchedWith;

      const page = launched.page;
      await loginToNote(page, { email, password });

      for (const note of targets) {
        try {
          await openNewNoteEditor(page);
          await fillNoteEditor(page, note.title, note.bodyPlainText);
          const noteUrl = await saveNote(page, mode);

          if (mode === "publish") {
            markPublished(state, note.slug, { noteUrl, mode });
          } else {
            markDraft(state, note.slug, { noteUrl, mode });
          }

          result.processed.push({
            slug: note.slug,
            title: note.title,
            mode,
            action: mode,
            noteUrl,
          });
          console.log(`[${mode}] ${note.slug}: ${noteUrl || "URL未取得"}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          markFailed(state, note.slug, message, { mode });
          result.errors.push(`${note.slug}: ${message}`);
          console.error(`[error] ${note.slug}: ${message}`);
        }
      }

      saveState(queueDir, state);
      result.status = result.errors.length
        ? (result.processed.length ? "部分失敗" : "失敗")
        : "成功";
    }
  }
} catch (error) {
  result.errors.push(error instanceof Error ? error.message : String(error));
  console.error(error instanceof Error ? error.message : error);
} finally {
  if (browserContext) {
    await browserContext.close().catch(() => {});
  }
}

writePublishResult();
if (result.status === "失敗") process.exitCode = 1;

function printHelp() {
  console.log(`使い方:
  node scripts/note_web_publish.mjs --dry-run true
  node scripts/note_web_publish.mjs --mode draft --dry-run false
  node scripts/note_web_publish.mjs --mode publish --dry-run false

オプション:
  --queue-dir DIR              既定: content-queue
  --dry-run true|false         既定: true
  --mode draft|publish         既定: draft
  --note-slug SLUG             単一 note を指定
  --limit N                    最大処理数
  --force true                 既公開 note も再処理
  --headless true|false        既定: false
  --browser-channel CHANNEL    chrome|msedge|auto（既定: auto）
  --user-data-dir DIR          既定: .note-playwright-profile

環境変数:
  NOTE_EMAIL
  NOTE_PASSWORD
`);
}

function discoverNoteFiles(dir, slugFilter) {
  const files = fs.readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => path.join(dir, name))
    .sort();

  if (!slugFilter) return files;
  return files.filter((filePath) => path.basename(filePath, ".md") === slugFilter);
}

function writePublishResult() {
  ensureDir(path.dirname(resultPath));
  const finishedAt = new Date().toISOString();
  const lines = [
    "# note.com 投稿結果",
    "",
    `- 判定: ${result.status}`,
    `- dry-run: ${result.dryRun}`,
    `- mode: ${result.mode}`,
    `- force: ${result.force}`,
    `- 開始: ${result.startedAt}`,
    `- 終了: ${finishedAt}`,
    "",
    "## ブラウザ",
    "",
    `- 要求チャンネル: ${result.browser.requestedChannel}`,
    `- 起動方式: ${result.browser.launchedWith}`,
    `- プロファイル: ${result.browser.userDataDir}`,
    `- ヘッドレス: ${result.browser.headless}`,
    "",
    "## 処理結果",
    ...(result.processed.length
      ? result.processed.map((item) => `- ${item.slug}: ${item.title} [${item.action}] ${item.noteUrl || ""}`)
      : ["- なし"]),
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
  console.log(`note publish result: ${resultPath}`);
}
