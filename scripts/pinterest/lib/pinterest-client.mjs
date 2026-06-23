import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { URL } from "node:url";
import { ensureDir, readJson, writeJson } from "./common.mjs";

const DEFAULT_SCOPES = [
  "boards:read",
  "boards:write",
  "pins:read",
  "pins:write",
  "user_accounts:read",
].join(",");

export function getPinterestConfig(options = {}) {
  const sandbox = options.sandbox === true || process.env.PINTEREST_SANDBOX === "true";
  const apiBase = sandbox ? "https://api-sandbox.pinterest.com/v5" : "https://api.pinterest.com/v5";
  const appId = options.appId || process.env.PINTEREST_APP_ID || "";
  const appSecret = options.appSecret || process.env.PINTEREST_APP_SECRET || "";
  const redirectUri = options.redirectUri || process.env.PINTEREST_REDIRECT_URI || "http://localhost:8765/callback";
  const tokenPath = options.tokenPath || process.env.PINTEREST_TOKEN_PATH || ".pinterest-oauth-token.json";

  if (!appId || !appSecret) {
    throw new Error("PINTEREST_APP_ID と PINTEREST_APP_SECRET を .env または環境変数に設定してください。");
  }

  return {
    sandbox,
    apiBase,
    appId,
    appSecret,
    redirectUri,
    tokenPath,
    scopes: options.scopes || process.env.PINTEREST_SCOPES || DEFAULT_SCOPES,
  };
}

function basicAuthHeader(appId, appSecret) {
  return `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`;
}

async function parseResponse(response) {
  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  if (!response.ok) {
    const message = body.message || body.error_description || body.error || text || response.statusText;
    throw new Error(`Pinterest API ${response.status}: ${message}`);
  }
  return body;
}

export async function exchangeAuthorizationCode(config, code) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    continuous_refresh: "true",
  });

  const response = await fetch(`${config.apiBase}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(config.appId, config.appSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const body = await parseResponse(response);
  return normalizeTokenPayload(body);
}

export async function refreshAccessToken(config, refreshToken) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(`${config.apiBase}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(config.appId, config.appSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const body = await parseResponse(response);
  return normalizeTokenPayload(body);
}

function normalizeTokenPayload(body) {
  const expiresIn = Number(body.expires_in || 0);
  return {
    access_token: body.access_token,
    refresh_token: body.refresh_token,
    token_type: body.token_type || "bearer",
    scope: body.scope || "",
    expires_in: expiresIn,
    expires_at: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : "",
    saved_at: new Date().toISOString(),
  };
}

export function loadToken(tokenPath) {
  if (!fs.existsSync(tokenPath)) return null;
  return readJson(tokenPath);
}

export function saveToken(tokenPath, token) {
  ensureDir(path.dirname(tokenPath));
  writeJson(tokenPath, token);
}

export async function getValidAccessToken(config) {
  const token = loadToken(config.tokenPath);
  if (!token?.access_token) {
    throw new Error(`トークンがありません。先に OAuth を実行してください: node scripts/pinterest_api_post.mjs auth`);
  }

  const expiresAt = token.expires_at ? Date.parse(token.expires_at) : 0;
  const stillValid = expiresAt > Date.now() + 60_000;
  if (stillValid) return token.access_token;

  if (!token.refresh_token) {
    throw new Error("アクセストークンの期限切れです。refresh_token がないため再認証が必要です。");
  }

  const refreshed = await refreshAccessToken(config, token.refresh_token);
  saveToken(config.tokenPath, refreshed);
  return refreshed.access_token;
}

export function buildAuthorizationUrl(config, state) {
  const url = new URL("https://www.pinterest.com/oauth/");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function runOAuthCallbackServer(config, timeoutMs = 300_000) {
  const redirect = new URL(config.redirectUri);
  const port = Number(redirect.port || (redirect.protocol === "https:" ? 443 : 80));
  const pathname = redirect.pathname || "/callback";
  const state = crypto.randomUUID();

  const authUrl = buildAuthorizationUrl(config, state);

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (request, response) => {
      try {
        const requestUrl = new URL(request.url || "/", `http://${request.headers.host}`);
        if (requestUrl.pathname !== pathname) {
          response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          response.end("Not Found");
          return;
        }

        const code = requestUrl.searchParams.get("code");
        const returnedState = requestUrl.searchParams.get("state");
        const error = requestUrl.searchParams.get("error");

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }
        if (!code) {
          throw new Error("OAuth code が URL に含まれていません。");
        }
        if (returnedState !== state) {
          throw new Error("OAuth state が一致しません。");
        }

        const token = await exchangeAuthorizationCode(config, code);
        saveToken(config.tokenPath, token);

        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end("<html><body><h1>Pinterest OAuth 成功</h1><p>このタブを閉じてターミナルに戻ってください。</p></body></html>");
        server.close();
        resolve({ authUrl, token });
      } catch (callbackError) {
        response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        response.end(String(callbackError instanceof Error ? callbackError.message : callbackError));
        server.close();
        reject(callbackError);
      }
    });

    server.listen(port, "127.0.0.1", () => {
      console.log(`OAuth callback server: http://127.0.0.1:${port}${pathname}`);
      console.log("次の URL をブラウザで開いて Pinterest 認可を完了してください:");
      console.log(authUrl);
    });

    server.on("error", reject);
    setTimeout(() => {
      server.close();
      reject(new Error(`OAuth が ${timeoutMs / 1000} 秒以内に完了しませんでした。`));
    }, timeoutMs);
  });
}

export async function pinterestRequest(config, accessToken, method, endpoint, body) {
  const response = await fetch(`${config.apiBase}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return parseResponse(response);
}

export async function listBoards(config, accessToken) {
  const boards = [];
  let bookmark = "";

  do {
    const query = bookmark ? `?page_size=100&bookmark=${encodeURIComponent(bookmark)}` : "?page_size=100";
    const body = await pinterestRequest(config, accessToken, "GET", `/boards${query}`);
    boards.push(...(body.items || []));
    bookmark = body.bookmark || "";
  } while (bookmark);

  return boards;
}

export async function createPin(config, accessToken, pinPayload) {
  return pinterestRequest(config, accessToken, "POST", "/pins", pinPayload);
}

export function resolveBoardId(boards, boardName, boardMap = {}) {
  if (boardMap[boardName]) return boardMap[boardName];
  const exact = boards.find((board) => board.name === boardName);
  if (exact) return exact.id;
  const partial = boards.find((board) => board.name?.includes(boardName) || boardName.includes(board.name || ""));
  if (partial) return partial.id;
  throw new Error(`ボードが見つかりません: ${boardName}`);
}

export function buildPinPayload(pin, boardId) {
  const imageUrl = pin.image?.publicUrl || pin.imagePublicUrl;
  if (!imageUrl) {
    throw new Error(`画像の public URL がありません: ${pin.id}`);
  }

  const payload = {
    board_id: boardId,
    title: pin.title,
    description: pin.description,
    link: pin.link,
    alt_text: pin.altText || pin.title,
    media_source: {
      source_type: "image_url",
      url: imageUrl,
    },
  };

  if (pin.publishAt) {
    payload.publish_at = pin.publishAt;
  }

  return payload;
}
