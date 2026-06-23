import fs from "node:fs";
import path from "node:path";
import { ensureDir } from "./common.mjs";

const DEFAULT_MODEL = "black-forest-labs/flux-1.1-pro";
const DEFAULT_ASPECT_RATIO = "2:3";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getFluxConfig(config = {}) {
  const flux = config.flux || {};
  const token = process.env.REPLICATE_API_TOKEN || flux.replicateApiToken || "";
  return {
    token,
    model: flux.model || DEFAULT_MODEL,
    aspectRatio: flux.aspectRatio || DEFAULT_ASPECT_RATIO,
    outputFormat: flux.outputFormat || "png",
    outputQuality: Number(flux.outputQuality || 90),
    numOutputs: Number(flux.numOutputs || 1),
    pollIntervalMs: Number(flux.pollIntervalMs || 2000),
    pollTimeoutMs: Number(flux.pollTimeoutMs || 180_000),
  };
}

export function assertFluxToken(fluxConfig) {
  if (!fluxConfig.token) {
    throw new Error("REPLICATE_API_TOKEN が未設定です。.env に Replicate API トークンを追加してください。");
  }
}

export async function generateFluxImage({
  prompt,
  negativePrompt = "",
  fluxConfig,
}) {
  assertFluxToken(fluxConfig);

  const input = {
    prompt,
    aspect_ratio: fluxConfig.aspectRatio,
    output_format: fluxConfig.outputFormat,
    output_quality: fluxConfig.outputQuality,
    num_outputs: fluxConfig.numOutputs,
  };

  if (negativePrompt) {
    input.negative_prompt = negativePrompt;
  }

  const prediction = await createPrediction(fluxConfig.model, input, fluxConfig.token);
  const finished = await waitForPrediction(prediction, fluxConfig);
  const outputUrl = normalizeOutputUrl(finished.output);
  if (!outputUrl) {
    throw new Error(`Flux output が空です: ${finished.id || "unknown prediction"}`);
  }
  return {
    predictionId: finished.id,
    outputUrl,
    model: fluxConfig.model,
  };
}

async function createPrediction(model, input, token) {
  const response = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
  });
  return parseResponse(response);
}

async function waitForPrediction(prediction, fluxConfig) {
  const started = Date.now();
  let current = prediction;

  while (!["succeeded", "failed", "canceled"].includes(current.status)) {
    if (Date.now() - started > fluxConfig.pollTimeoutMs) {
      throw new Error(`Flux generation timed out after ${fluxConfig.pollTimeoutMs}ms (${current.id})`);
    }
    await sleep(fluxConfig.pollIntervalMs);
    const response = await fetch(current.urls.get, {
      headers: { Authorization: `Bearer ${fluxConfig.token}` },
    });
    current = await parseResponse(response);
  }

  if (current.status !== "succeeded") {
    throw new Error(`Flux generation failed (${current.id}): ${current.error || current.status}`);
  }

  return current;
}

function normalizeOutputUrl(output) {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && output.length > 0) return output[0];
  return "";
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
    const message = body.detail || body.error || body.title || text || response.statusText;
    throw new Error(`Replicate API ${response.status}: ${message}`);
  }
  return body;
}

export async function downloadImage(outputUrl, destinationPath) {
  const response = await fetch(outputUrl);
  if (!response.ok) {
    throw new Error(`画像ダウンロード失敗 ${response.status}: ${outputUrl}`);
  }
  ensureDir(path.dirname(destinationPath));
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(destinationPath, buffer);
  return destinationPath;
}
