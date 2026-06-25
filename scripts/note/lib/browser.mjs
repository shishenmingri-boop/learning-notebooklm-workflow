import fs from "node:fs";
import path from "node:path";

const NOTE_LOGIN_URL = "https://note.com/login";
const NOTE_NEW_URL = "https://note.com/notes/new";

/**
 * @param {object} options
 * @param {string} options.userDataDir
 * @param {boolean} [options.headless]
 * @param {string} [options.browserChannel]
 * @returns {Promise<{ context: import('playwright').BrowserContext, page: import('playwright').Page, launchedWith: string }>}
 */
export async function launchBrowser(options) {
  const {
    userDataDir,
    headless = false,
    browserChannel = "auto",
  } = options;

  const { chromium } = await import("playwright").catch(() => {
    throw new Error("Playwrightがインストールされていません。次を実行してください: npm install -D playwright && npx playwright install chrome");
  });

  fs.mkdirSync(userDataDir, { recursive: true });

  const baseOptions = {
    headless,
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: false,
  };

  const channels = normalizeBrowserChannels(browserChannel);
  const requestedChannelIsAuto = String(browserChannel || "auto").trim().toLowerCase() === "auto";
  const launchErrors = [];

  for (const channel of channels) {
    try {
      const context = await chromium.launchPersistentContext(userDataDir, {
        ...baseOptions,
        channel: channel === "chromium" ? undefined : channel,
      });
      const page = context.pages()[0] || await context.newPage();
      return {
        context,
        page,
        launchedWith: channel === "chromium" ? "bundled-chromium" : `channel:${channel}`,
      };
    } catch (error) {
      launchErrors.push(`${channel}: ${error instanceof Error ? error.message : String(error)}`);
      if (!requestedChannelIsAuto) break;
    }
  }

  throw new Error([
    "通常のGoogle ChromeまたはMicrosoft Edgeを起動できませんでした。",
    "Chrome/Edgeをインストールして `--browser-channel chrome` または `--browser-channel msedge` を指定してください。",
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
    "msedge",
    "msedge-beta",
    "chromium",
  ];

  if (normalized === "auto") return ["chrome", "msedge"];
  if (supportedChannels.includes(normalized)) return [normalized];
  throw new Error(`未対応のbrowser channelです: ${value}`);
}

/**
 * @param {import('playwright').Page} page
 * @param {{ email: string, password: string }} credentials
 */
export async function loginToNote(page, credentials) {
  const { email, password } = credentials;
  if (!email || !password) {
    throw new Error("NOTE_EMAIL と NOTE_PASSWORD が必要です。.env を設定してください。");
  }

  await page.goto(NOTE_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

  if (await isLoggedIn(page)) {
    return;
  }

  const emailInput = page.locator("input[type='email'], input[name='email'], input[placeholder*='mail' i]").first();
  const passwordInput = page.locator("input[type='password']").first();

  await emailInput.waitFor({ state: "visible", timeout: 15000 });
  await emailInput.fill(email);
  await passwordInput.fill(password);

  const submitButton = page.getByRole("button", { name: /ログイン|login|sign in/i }).first();
  if (await submitButton.count()) {
    await submitButton.click();
  } else {
    await passwordInput.press("Enter");
  }

  await page.waitForTimeout(3000);

  if (!(await isLoggedIn(page))) {
    const bodyText = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    if (/メールアドレス|パスワード|ログインに失敗|incorrect|invalid/i.test(bodyText)) {
      throw new Error("note.com ログインに失敗しました。NOTE_EMAIL / NOTE_PASSWORD を確認してください。");
    }
    throw new Error("note.com ログイン状態を確認できませんでした。ブラウザで手動ログイン後に再実行してください。");
  }
}

/**
 * @param {import('playwright').Page} page
 */
export async function openNewNoteEditor(page) {
  await page.goto(NOTE_NEW_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);

  const titleInput = await findTitleInput(page);
  if (!titleInput) {
    throw new Error("note.com エディタのタイトル欄を検出できませんでした。");
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {string} title
 * @param {string} bodyPlainText
 */
export async function fillNoteEditor(page, title, bodyPlainText) {
  const titleInput = await findTitleInput(page);
  if (!titleInput) {
    throw new Error("タイトル入力欄が見つかりません");
  }

  await titleInput.click({ timeout: 5000 });
  await titleInput.fill(title, { timeout: 5000 });

  const bodyEditor = await findBodyEditor(page);
  if (!bodyEditor) {
    throw new Error("本文エディタが見つかりません");
  }

  await bodyEditor.click({ timeout: 5000 });

  await page.evaluate(async (text) => {
    await navigator.clipboard.writeText(text);
  }, bodyPlainText).catch(() => {});

  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.press(`${modifier}+KeyA`);
  await page.keyboard.press(`${modifier}+KeyV`);

  if (!(await bodyHasContent(bodyEditor))) {
    await bodyEditor.fill("");
    const paragraphs = bodyPlainText.split(/\n\n+/);
    for (let index = 0; index < paragraphs.length; index += 1) {
      if (index > 0) await page.keyboard.press("Enter");
      await page.keyboard.type(paragraphs[index], { delay: 5 });
    }
  }

  await page.waitForTimeout(1000);
}

async function bodyHasContent(editor) {
  const text = await editor.innerText().catch(() => "");
  return text.trim().length > 0;
}

/**
 * @param {import('playwright').Page} page
 * @param {"draft"|"publish"} mode
 * @returns {Promise<string>}
 */
export async function saveNote(page, mode) {
  if (mode === "publish") {
    await clickButton(page, [
      /公開に進む/i,
      /公開設定/i,
      /公開する/i,
    ], "公開ボタン");

    await page.waitForTimeout(1500);

    await clickButton(page, [
      /公開$/i,
      /投稿する/i,
      /公開する/i,
    ], "公開確定ボタン");
  } else {
    await clickButton(page, [
      /下書き保存/i,
      /保存/i,
      /draft/i,
    ], "下書き保存ボタン");
  }

  await page.waitForTimeout(3000);
  return extractNoteUrl(page);
}

/**
 * @param {import('playwright').Page} page
 * @returns {Promise<string>}
 */
async function extractNoteUrl(page) {
  const url = page.url();
  if (/note\.com\/[^/]+\/n\//.test(url) || /note\.com\/n\//.test(url)) {
    return url.split("?")[0];
  }

  const link = page.locator("a[href*='/n/']").first();
  if (await link.count()) {
    const href = await link.getAttribute("href");
    if (href) {
      return href.startsWith("http") ? href.split("?")[0] : `https://note.com${href.split("?")[0]}`;
    }
  }

  return url;
}

async function findTitleInput(page) {
  const candidates = [
    page.locator("textarea[placeholder*='タイトル']").first(),
    page.locator("input[placeholder*='タイトル']").first(),
    page.locator("[data-testid='title-input']").first(),
    page.locator(".o-noteContentHeader__title textarea").first(),
    page.locator(".o-noteContentHeader__title input").first(),
    page.getByPlaceholder(/タイトル|title/i).first(),
  ];

  for (const locator of candidates) {
    if (await locator.count().catch(() => 0)) {
      return locator;
    }
  }
  return null;
}

async function findBodyEditor(page) {
  const candidates = [
    page.locator("[data-testid='editor-body']").first(),
    page.locator(".ProseMirror").first(),
    page.locator("[contenteditable='true']").nth(1),
    page.locator("[contenteditable='true']").first(),
  ];

  for (const locator of candidates) {
    if (await locator.count().catch(() => 0)) {
      return locator;
    }
  }
  return null;
}

async function clickButton(page, patterns, label) {
  for (const pattern of patterns) {
    const button = page.getByRole("button", { name: pattern }).first();
    if (await button.count().catch(() => 0)) {
      await button.click({ timeout: 10000 });
      return;
    }
  }

  for (const pattern of patterns) {
    const link = page.getByRole("link", { name: pattern }).first();
    if (await link.count().catch(() => 0)) {
      await link.click({ timeout: 10000 });
      return;
    }
  }

  throw new Error(`${label}を検出できませんでした`);
}

async function isLoggedIn(page) {
  const url = page.url();
  if (/note\.com\/login/.test(url)) return false;

  const loginButton = page.getByRole("link", { name: /ログイン|login/i }).first();
  if (await loginButton.count().catch(() => 0)) {
    const visible = await loginButton.isVisible().catch(() => false);
    if (visible) return false;
  }

  const avatar = page.locator("[class*='avatar'], [class*='Avatar'], img[alt*='avatar' i]").first();
  if (await avatar.count().catch(() => 0)) return true;

  const newNoteLink = page.getByRole("link", { name: /新規|投稿|write/i }).first();
  if (await newNoteLink.count().catch(() => 0)) return true;

  if (!/login/.test(url) && /note\.com/.test(url)) {
    const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
    if (/マイページ|下書き|フォロー中|ホーム/i.test(bodyText)) return true;
  }

  return false;
}
