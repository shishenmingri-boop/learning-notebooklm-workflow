#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  console.log(`使い方:
  node notebooklm_web_upload.mjs --output-dir learning-output --notebook-title "テーマ"

オプション:
  --output-dir DIR          NotebookLM用Markdownファイルを含むディレクトリ
  --notebook-title TITLE    UIで可能な場合に使うノート名
  --user-data-dir DIR       永続化するPlaywrightプロファイルのディレクトリ
  --browser-channel CHANNEL 通常ブラウザのチャンネル。既定: auto。例: chrome, msedge
  --executable-path PATH    使用するChrome/Edge実行ファイルのパス
  --files A.md,B.md         出力ディレクトリからの相対パス、または絶対パスをカンマ区切りで指定
  --source-url-file FILE    NotebookLMへURLソースとして追加するURL一覧元。既定: sources.md
  --source-urls URLS        URLソースとして追加するURLをカンマ区切りで直接指定
  --skip-source-urls true   sources.mdのURLソース追加をスキップ
  --headless true           ブラウザをヘッドレスで実行
  --close-browser true      アップロード実行後すぐにブラウザを閉じる
  --auto-continue true      Enter待ちをスキップ（ログイン完了を自動検知、他は短い待機）
  --allow-bundled-chromium true
                           Googleログイン拒否の可能性を理解した上でPlaywright同梱Chromiumを許可
`);
  process.exit(0);
}
const outputDir = path.resolve(args["output-dir"] || "learning-output");
const notebookTitle = args["notebook-title"] || "学習ノート";
const defaultUserDataDir = path.resolve(".notebooklm-playwright-profile");
const userDataDir = path.resolve(args["user-data-dir"] || defaultUserDataDir);
const usingDefaultProfile = !args["user-data-dir"];
const requestedBrowserChannel = args["browser-channel"] || args.channel || process.env.NOTEBOOKLM_BROWSER_CHANNEL || "auto";
const executablePath = args["executable-path"] ? path.resolve(args["executable-path"]) : "";
const allowBundledChromium = args["allow-bundled-chromium"] === "true";
const autoContinue = args["auto-continue"] === "true";
const headless = args.headless === "true";
const targetFiles = (args.files ? args.files.split(",") : [
  "00_overview.md",
  "01_core_concepts.md",
  "02_deep_dive.md",
  "03_sources.md",
  "04_quiz_seed.md",
]).map((file) => path.isAbsolute(file) ? file : path.resolve(outputDir, file));
const sourceUrlFile = args["source-url-file"]
  ? (path.isAbsolute(args["source-url-file"]) ? args["source-url-file"] : path.resolve(outputDir, args["source-url-file"]))
  : path.resolve(outputDir, "sources.md");
const targetSourceUrls = args["skip-source-urls"] === "true"
  ? []
  : (args["source-urls"] ? parseUrlList(args["source-urls"]) : extractUrlsFromFile(sourceUrlFile));

const resultPath = path.resolve(outputDir, "notebooklm-upload-result.md");
const rl = readline.createInterface({ input, output });
const result = {
  startedAt: new Date().toISOString(),
  status: "失敗",
  notebookUrl: "",
  uploadedFiles: [],
  targetFiles: targetFiles.map((file) => path.relative(process.cwd(), file)),
  targetSourceUrls,
  uploadedSourceUrls: [],
  failedSourceUrls: [],
  quizAction: "未実行",
  manualCheckpoints: [],
  errors: [],
  diagnostics: [],
  browser: {
    requestedChannel: requestedBrowserChannel,
    executablePath: executablePath || "",
    launchedWith: "未起動",
    userDataDir,
    profileMode: usingDefaultProfile ? "stable-default" : "custom",
    headless,
  },
};
let browserContext;

try {
  result.diagnostics.push(
    usingDefaultProfile
      ? `既定の安定プロファイルを使用: ${userDataDir}`
      : `カスタムプロファイルを使用: ${userDataDir}`,
  );
  assertOutputFiles(targetFiles);
  const { chromium } = await import("playwright").catch(() => {
    throw new Error("Playwrightがインストールされていません。次を実行してください: npm install -D playwright && npx playwright install chrome");
  });

  browserContext = await launchPersistentContext(chromium);
  const page = browserContext.pages()[0] || await browserContext.newPage();

  await page.goto("https://notebooklm.google.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await assertGoogleLoginBrowserAccepted(page);
  await maybeLoginCheckpoint(page);
  await assertGoogleLoginBrowserAccepted(page);

  await createNotebook(page);
  await page.waitForTimeout(1500);
  result.notebookUrl = page.url();

  await maybeSetTitle(page, notebookTitle);
  await uploadFiles(page, targetFiles);
  await addSourceUrls(page, targetSourceUrls);
  await clickQuiz(page);

  result.status = "成功またはユーザー確認済み";
  result.notebookUrl = page.url();
  await writeResult();
  console.log(`NotebookLMアップロード結果を書き込みました: ${resultPath}`);

  if (args["close-browser"] === "true") {
    await browserContext.close();
    browserContext = undefined;
  } else {
    await checkpoint("NotebookLMノートを確認してください。Playwrightブラウザを閉じるにはEnterを押してください。");
    await browserContext.close();
    browserContext = undefined;
  }
} catch (error) {
  result.errors.push(error instanceof Error ? error.message : String(error));
  await writeResult();
  if (browserContext) {
    await browserContext.close().catch(() => {});
    browserContext = undefined;
  }
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  rl.close();
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;
    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function assertOutputFiles(files) {
  const missing = files.filter((file) => !fs.existsSync(file));
  if (missing.length > 0) {
    throw new Error(`アップロード対象ファイルが見つかりません:\n${missing.map((file) => `- ${file}`).join("\n")}`);
  }
}

function parseUrlList(value) {
  return uniqueUrls(String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean));
}

function extractUrlsFromFile(file) {
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, "utf8");
  const matches = content.match(/https?:\/\/[^\s<>)\]]+/g) || [];
  return uniqueUrls(matches.map((url) => url.replace(/[.,;:]+$/, "")));
}

function uniqueUrls(urls) {
  return [...new Set(urls.filter(Boolean))];
}

async function launchPersistentContext(chromium) {
  const baseOptions = {
    headless,
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  };

  if (executablePath) {
    if (!fs.existsSync(executablePath)) {
      throw new Error(`指定されたブラウザ実行ファイルが見つかりません: ${executablePath}`);
    }
    result.browser.launchedWith = `executable-path:${executablePath}`;
    return chromium.launchPersistentContext(userDataDir, {
      ...baseOptions,
      executablePath,
    });
  }

  const channels = normalizeBrowserChannels(requestedBrowserChannel);
  const requestedChannelIsAuto = String(requestedBrowserChannel || "auto").trim().toLowerCase() === "auto";
  const launchErrors = [];

  for (const channel of channels) {
    if (channel === "chromium") {
      if (!allowBundledChromium) {
        throw new Error([
          "Playwright同梱ChromiumはGoogleログインで拒否されることがあるため既定では使いません。",
          "通常のGoogle ChromeまたはMicrosoft Edgeをインストールし、`--browser-channel chrome` または `--browser-channel msedge` を指定してください。",
          "検証目的で同梱Chromiumを使う場合のみ `--allow-bundled-chromium true --browser-channel chromium` を指定してください。",
        ].join(" "));
      }
      result.browser.launchedWith = "bundled-chromium";
      return chromium.launchPersistentContext(userDataDir, baseOptions);
    }

    try {
      result.browser.launchedWith = `channel:${channel}`;
      return await chromium.launchPersistentContext(userDataDir, {
        ...baseOptions,
        channel,
      });
    } catch (error) {
      launchErrors.push(`${channel}: ${error instanceof Error ? error.message : String(error)}`);
      if (!requestedChannelIsAuto) break;
    }
  }

  result.browser.launchedWith = "未起動";
  throw new Error([
    "通常のGoogle ChromeまたはMicrosoft Edgeを起動できませんでした。",
    "GoogleログインはPlaywright同梱Chromiumを拒否する場合があります。",
    "Chrome/Edgeをインストールして再実行するか、`--executable-path` でブラウザ実行ファイルを指定してください。",
    "自動化できない場合はNotebookLMへ手動アップロードしてください。",
    "",
    "起動エラー:",
    ...launchErrors.map((item) => `- ${item}`),
  ].join("\n"));
}

function normalizeBrowserChannels(value) {
  const normalized = String(value || "auto").trim().toLowerCase();
  const supportedChannels = [
    "chrome",
    "chrome-beta",
    "chrome-dev",
    "chrome-canary",
    "msedge",
    "msedge-beta",
    "msedge-dev",
    "msedge-canary",
    "chromium",
  ];

  if (normalized === "auto") return ["chrome", "msedge"];
  if (supportedChannels.includes(normalized)) return [normalized];
  throw new Error(`未対応のbrowser channelです: ${value}`);
}

async function checkpoint(message) {
  result.manualCheckpoints.push(message);
  if (autoContinue) {
    console.log(`\n[auto-continue] ${message}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return;
  }
  await rl.question(`\n${message}\n`);
}

async function maybeLoginCheckpoint(page) {
  if (!(await looksLikeLoginRequired(page))) return;
  if (autoContinue) {
    console.log("\n[auto-continue] Googleログイン待機中（最大3分）。開いたブラウザでログインしてください。");
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
      await page.waitForTimeout(2000);
      if (!(await looksLikeLoginRequired(page))) {
        await page.goto("https://notebooklm.google.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
        return;
      }
    }
    throw new Error("Googleログインがタイムアウトしました。ブラウザでログイン後に再実行してください。");
  }
  await checkpoint("Googleログインが必要です。開いたブラウザでログインを完了してからEnterを押してください。");
}

async function assertGoogleLoginBrowserAccepted(page) {
  const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  const isRejected = /Couldn't sign you in|Couldn.t sign you in|This browser or app may not be secure|このブラウザまたはアプリは安全でない可能性があります|安全でないブラウザ/i.test(bodyText);
  if (!isRejected) return;

  throw new Error([
    "Googleログインがブラウザを安全でないものとして拒否しました。",
    "Playwright同梱Chromiumまたは自動化検出により、`Couldn't sign you in` / `This browser or app may not be secure` が表示されています。",
    "通常のGoogle ChromeまたはMicrosoft Edgeを使って再実行してください。例: `--browser-channel chrome` または `--browser-channel msedge`。",
    `ログイン再利用が必要な場合は、同じプロファイル(${userDataDir})を通常ブラウザで開いてNotebookLMへ先にログインしてから再実行してください。`,
    "それでも拒否される場合は、この結果ファイルの「最短リカバリー手順」に沿ってNotebookLMへ手動アップロードしてください。",
  ].join(" "));
}

async function looksLikeLoginRequired(page) {
  const url = page.url();
  if (/accounts\.google\.com|ServiceLogin|signin/i.test(url)) return true;

  const loginEntryPoints = [
    page.getByRole("button", { name: /sign in|ログイン/i }).first(),
    page.getByRole("link", { name: /sign in|ログイン/i }).first(),
    page.locator("input[type='email']").first(),
  ];

  for (const locator of loginEntryPoints) {
    if (await locator.count().catch(() => 0)) return true;
  }

  return false;
}

async function createNotebook(page) {
  const candidates = [
    {
      label: "role button: ノートブックを新規作成",
      locator: () => page.getByRole("button", { name: /ノートブックを新規作成/i }).first(),
    },
    {
      label: "role button: 新規作成",
      locator: () => page.getByRole("button", { name: /新規作成/i }).first(),
    },
    {
      label: "css button[aria-label*='ノートブックを新規作成']",
      locator: () => page.locator("button[aria-label*='ノートブックを新規作成']").first(),
    },
    {
      label: "css .create-new-button",
      locator: () => page.locator(".create-new-button").first(),
    },
    {
      label: "css .create-new-action-button",
      locator: () => page.locator(".create-new-action-button").first(),
    },
    {
      label: "text: ノートブックを新規作成",
      locator: () => page.getByText(/ノートブックを新規作成/i).first(),
    },
    {
      label: "text: 新規作成",
      locator: () => page.getByText(/新規作成/i).first(),
    },
    {
      label: "role button: create new",
      locator: () => page.getByRole("button", { name: /create new/i }).first(),
    },
    {
      label: "role button: new notebook",
      locator: () => page.getByRole("button", { name: /new notebook/i }).first(),
    },
  ];

  const ready = await waitForAnyLocator(candidates, 30000);
  if (ready) {
    result.diagnostics.push(`NotebookLM作成ボタン候補を検出: ${ready.label}`);
    try {
      await ready.locator.click({ timeout: 5000 });
      await page.waitForTimeout(3000);
      return;
    } catch (error) {
      result.diagnostics.push(`NotebookLM作成ボタンクリック失敗: ${ready.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const counts = await locatorCounts(candidates);
  result.diagnostics.push(`NotebookLM作成ボタン候補の検出数: ${counts.join(", ")}`);

  for (const candidate of candidates) {
    const button = candidate.locator();
    if (await button.count().catch(() => 0)) {
      try {
        await button.click({ timeout: 5000 });
        result.diagnostics.push(`NotebookLM作成ボタンをクリック: ${candidate.label}`);
        await page.waitForTimeout(3000);
        return;
      } catch (error) {
        result.diagnostics.push(`NotebookLM作成ボタンクリック失敗: ${candidate.label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  await checkpoint("NotebookLMの作成ボタンを確実に見つけられませんでした。ブラウザで新しいノートを作成してからEnterを押してください。");
}

async function waitForAnyLocator(candidates, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const candidate of candidates) {
      const locator = candidate.locator();
      const count = await locator.count().catch(() => 0);
      if (count > 0 && await locator.isVisible().catch(() => false)) {
        return { ...candidate, locator };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
}

async function locatorCounts(candidates) {
  const counts = [];
  for (const candidate of candidates) {
    const count = await candidate.locator().count().catch((error) => `ERR:${error.message}`);
    counts.push(`${candidate.label}=${count}`);
  }
  return counts;
}

async function maybeSetTitle(page, title) {
  const titleCandidates = [
    page.getByRole("textbox", { name: /title|タイトル|notebook/i }).first(),
    page.locator("input[placeholder*='title' i]").first(),
    page.locator("input[aria-label*='title' i]").first(),
    page.locator("[contenteditable='true']").first(),
  ];

  for (const locator of titleCandidates) {
    if (await locator.count().catch(() => 0)) {
      try {
        await locator.click({ timeout: 3000 });
        await locator.fill(title, { timeout: 3000 });
        return;
      } catch {
        // 一部のタイトル欄はfillできないため、次を試します。
      }
    }
  }
}

async function uploadFiles(page, files) {
  let fileInput = page.locator("input[type='file']").first();
  if (!(await fileInput.count().catch(() => 0))) {
    await clickUploadEntryPoint(page);
    await page.waitForTimeout(1500);
    fileInput = page.locator("input[type='file']").first();
  }

  if (await fileInput.count().catch(() => 0)) {
    await fileInput.setInputFiles(files);
    result.uploadedFiles = files.map((file) => path.relative(process.cwd(), file));
    await page.waitForTimeout(5000);
    return;
  }

  await checkpoint("ファイルアップロード入力を見つけられませんでした。ブラウザでMarkdownファイルを手動アップロードしてからEnterを押してください。");
  result.uploadedFiles = files.map((file) => `${path.relative(process.cwd(), file)} (ユーザー確認済み)`);
}

async function addSourceUrls(page, urls) {
  if (urls.length === 0) {
    result.diagnostics.push("NotebookLM URLソース追加対象: なし");
    return;
  }

  result.diagnostics.push(`NotebookLM URLソース追加対象: ${urls.length}件`);
  const failed = [];

  for (const url of urls) {
    try {
      await addSingleSourceUrl(page, url);
      result.uploadedSourceUrls.push(url);
      result.diagnostics.push(`NotebookLM URLソース追加成功: ${url}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failedSourceUrls.push(`${url} (${message})`);
      result.diagnostics.push(`NotebookLM URLソース追加失敗: ${url}: ${message}`);
      failed.push(url);
      break;
    }
  }

  if (failed.length > 0) {
    const remaining = urls.filter((url) => !result.uploadedSourceUrls.includes(url));
    await checkpoint([
      "URLソースの自動追加を完了できませんでした。",
      "開いているNotebookLM画面で次のURLをソースとして手動追加してからEnterを押してください。",
      ...remaining.map((url) => `- ${url}`),
    ].join("\n"));
    for (const url of remaining) {
      if (!result.uploadedSourceUrls.includes(url)) {
        result.uploadedSourceUrls.push(`${url} (ユーザー確認済み)`);
      }
    }
  }
}

async function addSingleSourceUrl(page, url) {
  await clickAddSourceEntryPoint(page);
  await page.waitForTimeout(1000);
  await clickWebsiteEntryPoint(page);
  await page.waitForTimeout(500);

  const input = await findUrlInput(page);
  await input.fill(url, { timeout: 5000 });

  await clickSubmitUrlSource(page);
  await page.waitForTimeout(2500);
}

async function clickAddSourceEntryPoint(page) {
  const candidates = [
    { label: "role button: ソースを追加", locator: () => page.getByRole("button", { name: /ソースを追加|ソースを追加する|add source/i }).first() },
    { label: "role button: 追加", locator: () => page.getByRole("button", { name: /追加|add/i }).first() },
    { label: "text: ソースを追加", locator: () => page.getByText(/ソースを追加|ソースを追加する|add source/i).first() },
  ];

  await clickFirstVisible(candidates, 10000, "ソース追加入口");
}

async function clickWebsiteEntryPoint(page) {
  const candidates = [
    { label: "role button: ウェブサイト", locator: () => page.getByRole("button", { name: /ウェブサイト|web\s*site|website|URL|リンク/i }).first() },
    { label: "role tab: ウェブサイト", locator: () => page.getByRole("tab", { name: /ウェブサイト|web\s*site|website|URL|リンク/i }).first() },
    { label: "text: ウェブサイト", locator: () => page.getByText(/ウェブサイト|web\s*site|website|URL|リンク/i).first() },
  ];

  await clickFirstVisible(candidates, 10000, "ウェブサイト追加入口");
}

async function findUrlInput(page) {
  const candidates = [
    { label: "textbox: URL", locator: () => page.getByRole("textbox", { name: /URL|リンク|ウェブサイト|website|web address/i }).first() },
    { label: "input[type=url]", locator: () => page.locator("input[type='url']").first() },
    { label: "input placeholder URL", locator: () => page.locator("input[placeholder*='URL' i], input[aria-label*='URL' i]").first() },
    { label: "textarea placeholder URL", locator: () => page.locator("textarea[placeholder*='URL' i], textarea[aria-label*='URL' i]").first() },
    { label: "first visible textbox", locator: () => page.getByRole("textbox").first() },
  ];

  const ready = await waitForAnyLocator(candidates, 10000);
  if (!ready) {
    const counts = await locatorCounts(candidates);
    throw new Error(`URL入力欄を検出できませんでした: ${counts.join(", ")}`);
  }
  return ready.locator;
}

async function clickSubmitUrlSource(page) {
  const candidates = [
    { label: "role button: 挿入", locator: () => page.getByRole("button", { name: /挿入|追加|送信|insert|add|submit/i }).last() },
    { label: "text: 挿入", locator: () => page.getByText(/挿入|追加|insert|add/i).last() },
  ];

  await clickFirstVisible(candidates, 10000, "URL追加実行ボタン");
}

async function clickFirstVisible(candidates, timeoutMs, label) {
  const ready = await waitForAnyLocator(candidates, timeoutMs);
  if (!ready) {
    const counts = await locatorCounts(candidates);
    throw new Error(`${label}を検出できませんでした: ${counts.join(", ")}`);
  }

  try {
    await ready.locator.click({ timeout: 5000 });
    result.diagnostics.push(`${label}をクリック: ${ready.label}`);
  } catch (error) {
    throw new Error(`${label}のクリックに失敗しました: ${ready.label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function clickQuiz(page) {
  const candidates = [
    { label: "role button: クイズ", locator: () => page.getByRole("button", { name: /クイズ|quiz/i }).first() },
    { label: "role tab: クイズ", locator: () => page.getByRole("tab", { name: /クイズ|quiz/i }).first() },
    { label: "text: クイズ", locator: () => page.getByText(/クイズ|quiz/i).first() },
  ];

  try {
    await clickFirstVisible(candidates, 20000, "クイズ");
    await page.waitForTimeout(3000);
    result.quizAction = "クリック済み";
    result.diagnostics.push("NotebookLMクイズをクリックしました。");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.quizAction = `手動確認済み (${message})`;
    result.diagnostics.push(`NotebookLMクイズクリック失敗: ${message}`);
    await checkpoint("NotebookLMの「クイズ」を自動クリックできませんでした。ブラウザで「クイズ」を押してからEnterを押してください。");
  }
}

async function clickUploadEntryPoint(page) {
  const candidates = [
    /ファイルをアップロード/i,
    /upload file/i,
    /upload files/i,
    /add source/i,
    /upload/i,
    /source/i,
    /ソース/i,
    /アップロード/i,
    /追加/i,
  ];

  for (const name of candidates) {
    const button = page.getByRole("button", { name }).first();
    if (await button.count().catch(() => 0)) {
      try {
        await button.click({ timeout: 5000 });
        return;
      } catch {
        // 次のラベルを試します。
      }
    }
  }
}

async function writeResult() {
  fs.mkdirSync(outputDir, { recursive: true });
  const finishedAt = new Date().toISOString();
  const durationSec = Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(result.startedAt)) / 1000));
  const immediateActions = buildImmediateActions();
  const lines = [
    "# NotebookLMアップロード結果",
    "",
    "## 実行サマリー",
    "",
    `- 判定: ${result.status === "成功またはユーザー確認済み" ? "✅ 成功またはユーザー確認済み" : "❌ 失敗"}`,
    `- 実行開始: ${result.startedAt}`,
    `- 実行終了: ${finishedAt}`,
    `- 所要時間(秒): ${durationSec}`,
    `- NotebookLM URL: ${result.notebookUrl || "未取得"}`,
    "",
    "## 最短リカバリー手順",
    "",
    ...immediateActions.map((item) => `- ${item}`),
    "",
    "## 実行詳細",
    "",
    `- ステータス: ${result.status}`,
    `- NotebookLM URL: ${result.notebookUrl || "未取得"}`,
    "",
    "## ブラウザ",
    "",
    `- 要求チャンネル: ${result.browser.requestedChannel}`,
    `- 起動方式: ${result.browser.launchedWith}`,
    `- 実行ファイル: ${result.browser.executablePath || "未指定"}`,
    `- Playwrightプロファイル: ${result.browser.userDataDir}`,
    `- プロファイルモード: ${result.browser.profileMode}`,
    `- ヘッドレス: ${result.browser.headless ? "true" : "false"}`,
    "",
    "## 投入対象ファイル",
    "",
    ...result.targetFiles.map((file) => `- ${file}`),
    "",
    "## アップロード確認",
    "",
    ...(result.uploadedFiles.length ? result.uploadedFiles.map((file) => `- ${file}`) : ["- 未確認"]),
    "",
    "## URLソース追加対象",
    "",
    ...(result.targetSourceUrls.length ? result.targetSourceUrls.map((url) => `- ${url}`) : ["- なし"]),
    "",
    "## URLソース追加確認",
    "",
    ...(result.uploadedSourceUrls.length ? result.uploadedSourceUrls.map((url) => `- ${url}`) : ["- 未確認"]),
    "",
    "## URLソース追加失敗",
    "",
    ...(result.failedSourceUrls.length ? result.failedSourceUrls.map((url) => `- ${url}`) : ["- なし"]),
    "",
    "## クイズ操作",
    "",
    `- ${result.quizAction}`,
    "",
    "## 手動介入ポイント",
    "",
    ...(result.manualCheckpoints.length ? result.manualCheckpoints.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## エラー",
    "",
    ...(result.errors.length ? result.errors.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## 診断情報",
    "",
    ...(result.diagnostics.length ? result.diagnostics.map((item) => `- ${item}`) : ["- なし"]),
    "",
    "## 次のアクション",
    "",
    result.status === "成功またはユーザー確認済み"
      ? "- NotebookLM上でソース取り込み完了を確認し、`notebooklm-prompt.md` の内容をチャットに貼り付けてください。"
      : "- NotebookLMを開き、上の「最短リカバリー手順」に沿って復旧してください。",
    "",
    "## 手動フォールバック手順",
    "",
    "1. 通常のGoogle ChromeまたはMicrosoft Edgeで https://notebooklm.google.com/ を開きます。",
    `2. 新しいノートを作成し、ノート名を \`${notebookTitle}\` にします。`,
    "3. 上記の投入対象ファイルをソースとしてアップロードします。",
    "4. 上記のURLソース追加対象をソースとして追加します。",
    "5. `notebooklm-prompt.md` の内容をNotebookLMのチャットに貼り付けます。",
    "6. 学習ロードマップ、概念説明、クイズ、弱点復習計画を生成します。",
    "",
  ];
  fs.writeFileSync(resultPath, `${lines.join("\n")}\n`, "utf8");
}

function buildImmediateActions() {
  if (result.status === "成功またはユーザー確認済み") {
    return [
      "NotebookLM画面でソース取り込み完了を確認する",
      "`notebooklm-prompt.md` をNotebookLMチャットに貼り付ける",
    ];
  }

  const googleBlocked = isGoogleLoginBlocked(result.errors);
  if (googleBlocked) {
    return [
      "通常のChromeまたはEdgeで https://notebooklm.google.com/ を開き、同じプロファイルでログイン状態を作る",
      `同じコマンドを再実行する（必要なら \`--user-data-dir "${userDataDir}"\` を明示）`,
      "再実行でも拒否される場合は、投入対象ファイルとURLをこの結果ファイルの一覧どおり手動投入する",
    ];
  }

  return [
    "エラー内容を確認し、必要な手動操作をブラウザで実施する",
    "必要なら同じコマンドを再実行する",
    "自動化困難な場合は、投入対象ファイルとURLを手動でNotebookLMへ投入する",
  ];
}

function isGoogleLoginBlocked(errors) {
  const joined = (errors || []).join("\n");
  return /Couldn't sign you in|Couldn.t sign you in|This browser or app may not be secure|安全でないブラウザ|安全でない可能性/i.test(joined);
}
