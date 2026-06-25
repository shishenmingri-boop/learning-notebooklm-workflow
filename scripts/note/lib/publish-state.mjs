import path from "node:path";
import { ensureDir, readJson, writeJson } from "../../pinterest/lib/common.mjs";

const DEFAULT_STATE = {
  version: 1,
  notes: {},
};

/**
 * @param {string} queueDir
 * @returns {string}
 */
export function getStatePath(queueDir) {
  return path.resolve(queueDir, "note-publish-state.json");
}

/**
 * @param {string} queueDir
 * @returns {{ version: number, notes: Record<string, object> }}
 */
export function loadState(queueDir) {
  const statePath = getStatePath(queueDir);
  try {
    const state = readJson(statePath);
    if (!state.notes || typeof state.notes !== "object") {
      return { ...DEFAULT_STATE };
    }
    return state;
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/**
 * @param {string} queueDir
 * @param {{ version: number, notes: Record<string, object> }} state
 */
export function saveState(queueDir, state) {
  const statePath = getStatePath(queueDir);
  ensureDir(path.dirname(statePath));
  writeJson(statePath, state);
}

/**
 * @param {Record<string, object>} state
 * @param {string} slug
 * @param {{ noteUrl?: string, mode?: string }} details
 */
export function markDraft(state, slug, details = {}) {
  state.notes[slug] = {
    status: "draft",
    noteUrl: details.noteUrl || state.notes[slug]?.noteUrl || "",
    publishedAt: "",
    lastError: "",
    mode: details.mode || "draft",
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @param {Record<string, object>} state
 * @param {string} slug
 * @param {{ noteUrl?: string, mode?: string }} details
 */
export function markPublished(state, slug, details = {}) {
  state.notes[slug] = {
    status: "published",
    noteUrl: details.noteUrl || state.notes[slug]?.noteUrl || "",
    publishedAt: new Date().toISOString(),
    lastError: "",
    mode: details.mode || "publish",
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @param {Record<string, object>} state
 * @param {string} slug
 * @param {string} errorMessage
 * @param {{ mode?: string }} details
 */
export function markFailed(state, slug, errorMessage, details = {}) {
  const existing = state.notes[slug] || {};
  state.notes[slug] = {
    status: "failed",
    noteUrl: existing.noteUrl || "",
    publishedAt: existing.publishedAt || "",
    lastError: errorMessage,
    mode: details.mode || existing.mode || "",
    updatedAt: new Date().toISOString(),
  };
}

/**
 * @param {{ notes: Record<string, { status?: string }> }} state
 * @param {string} slug
 * @param {string} mode
 * @param {{ force?: boolean }} options
 * @returns {boolean}
 */
export function shouldPublish(state, slug, mode, options = {}) {
  const { force = false } = options;
  if (force) return true;

  const entry = state.notes[slug];
  if (!entry) return true;

  if (mode === "publish" && entry.status === "published") {
    return false;
  }

  if (mode === "draft" && entry.status === "published") {
    return false;
  }

  return true;
}
