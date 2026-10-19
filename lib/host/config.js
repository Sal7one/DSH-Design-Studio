import { KEY_REF } from "./constants.js";

export function createConfig({ ctx, credentials, llm, readJson, writeJson }) {
  let visionInfoCache = null;

  function invalidateVisionCache() {
    visionInfoCache = null;
  }

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

const DEFAULT_CONFIG = {
  visionModels: ["openai/gpt-4o-mini"],
  effort: "off",
  visionTransport: "auto",
  reviewStyle: "strict",
  autoVerify: true,
  capture: { width: 1440, height: 1700 },
  agentPreset: "",
  autoDeleteWithSession: false,
  options: {
    baseUrl: "https://openrouter.ai/api/v1",
    temperature: 0,
    maxTokens: 512,
    providerRouting: true,
    quantizations: ["fp8", "bf16", "fp16", "fp32", "unknown"],
    onlyProviders: [],
    allowFallbacks: true,
    includeUsage: true,
    reasoningExclude: false,
  },
};

async function loadConfig() {
  const parsed = await readJson("_studio/config.json");
  if (!parsed || typeof parsed !== "object") return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  const capture = parsed.capture && typeof parsed.capture === "object" ? parsed.capture : {};
  return {
    visionModels: Array.isArray(parsed.visionModels) && parsed.visionModels.length ? parsed.visionModels.map(String).filter(Boolean) : DEFAULT_CONFIG.visionModels.slice(),
    effort: ["auto", "off", "low", "medium", "high", "max"].includes(parsed.effort) ? parsed.effort : DEFAULT_CONFIG.effort,
    visionTransport: ["auto", "harness", "openrouter"].includes(parsed.visionTransport) ? parsed.visionTransport : DEFAULT_CONFIG.visionTransport,
    reviewStyle: ["strict", "balanced", "lenient"].includes(parsed.reviewStyle) ? parsed.reviewStyle : DEFAULT_CONFIG.reviewStyle,
    autoVerify: parsed.autoVerify !== false,
    capture: {
      width: clampInt(capture.width, 640, 2560, DEFAULT_CONFIG.capture.width),
      height: clampInt(capture.height, 720, 3000, DEFAULT_CONFIG.capture.height),
    },
    agentPreset: typeof parsed.agentPreset === "string" ? parsed.agentPreset : DEFAULT_CONFIG.agentPreset,
    autoDeleteWithSession: Boolean(parsed.autoDeleteWithSession),
    options: Object.assign({}, DEFAULT_CONFIG.options, parsed.options && typeof parsed.options === "object" ? parsed.options : {}),
  };
}

async function resolveKey() {
  if (credentials === undefined) return null;
  try {
    const r = await credentials.resolve(KEY_REF);
    return r ? r.value : null;
  } catch (_) {
    return null;
  }
}

async function keyInfo() {
  if (credentials === undefined) {
    return { supported: false, configured: false, source: null, writable: false, note: "credential service unavailable in this host" };
  }
  try {
    const info = await credentials.describe(KEY_REF);
    return { supported: true, configured: Boolean(info.configured), source: info.source || null, writable: Boolean(info.writable) };
  } catch (err) {
    return { supported: true, configured: false, source: null, writable: false, note: String((err && err.message) || "describe failed") };
  }
}

async function saveConfig(patch) {
  const cfg = await loadConfig();
  if (patch && typeof patch === "object") {
    if (patch.visionModels !== undefined) {
      const list = Array.isArray(patch.visionModels)
        ? patch.visionModels.map(String).map((s) => s.trim()).filter(Boolean)
        : String(patch.visionModels).split(",").map((s) => s.trim()).filter(Boolean);
      if (!list.length) throw new Error("at least one vision model is required");
      cfg.visionModels = list;
    }
    if (patch.effort !== undefined) {
      if (!["auto", "off", "low", "medium", "high", "max"].includes(patch.effort)) throw new Error("effort must be one of auto|off|low|medium|high|max");
      cfg.effort = patch.effort;
    }
    if (patch.visionTransport !== undefined) {
      if (!["auto", "harness", "openrouter"].includes(patch.visionTransport)) throw new Error("visionTransport must be one of auto|harness|openrouter");
      cfg.visionTransport = patch.visionTransport;
    }
    if (patch.reviewStyle !== undefined) {
      if (!["strict", "balanced", "lenient"].includes(patch.reviewStyle)) throw new Error("reviewStyle must be one of strict|balanced|lenient");
      cfg.reviewStyle = patch.reviewStyle;
    }
    if (patch.autoVerify !== undefined) cfg.autoVerify = Boolean(patch.autoVerify);
    if (patch.agentPreset !== undefined) {
      if (typeof patch.agentPreset !== "string") throw new Error("agentPreset must be a string");
      cfg.agentPreset = patch.agentPreset.trim();
    }
    if (patch.capture !== undefined && typeof patch.capture === "object") {
      cfg.capture = {
        width: clampInt(patch.capture.width, 640, 2560, cfg.capture.width),
        height: clampInt(patch.capture.height, 720, 3000, cfg.capture.height),
      };
    }
    if (patch.autoDeleteWithSession !== undefined) cfg.autoDeleteWithSession = Boolean(patch.autoDeleteWithSession);
    if (patch.options !== undefined && typeof patch.options === "object") {
      const o = patch.options;
      const n = cfg.options;
      if (o.baseUrl !== undefined) {
        const b = String(o.baseUrl).replace(/\/+$/, "");
        if (!/^https?:\/\//.test(b)) throw new Error("baseUrl must start with http(s)://");
        n.baseUrl = b;
      }
      if (o.temperature !== undefined) {
        const t = Number(o.temperature);
        if (!(t >= 0 && t <= 2)) throw new Error("temperature must be 0..2");
        n.temperature = t;
      }
      if (o.maxTokens !== undefined) {
        const m = Number(o.maxTokens);
        if (!(m >= 16 && m <= 128000)) throw new Error("maxTokens must be 16..128000");
        n.maxTokens = Math.floor(m);
      }
      if (o.providerRouting !== undefined) n.providerRouting = Boolean(o.providerRouting);
      if (o.quantizations !== undefined) n.quantizations = (Array.isArray(o.quantizations) ? o.quantizations : String(o.quantizations).split(",").map((s) => s.trim()).filter(Boolean)).map(String);
      if (o.onlyProviders !== undefined) n.onlyProviders = (Array.isArray(o.onlyProviders) ? o.onlyProviders : String(o.onlyProviders).split(",").map((s) => s.trim()).filter(Boolean)).map(String);
      if (o.allowFallbacks !== undefined) n.allowFallbacks = Boolean(o.allowFallbacks);
      if (o.includeUsage !== undefined) n.includeUsage = Boolean(o.includeUsage);
      if (o.reasoningExclude !== undefined) n.reasoningExclude = Boolean(o.reasoningExclude);
    }
  }
  await writeJson("_studio/config.json", cfg);
  return cfg;
}

function harnessRouteAvailable() {
  if (llm === undefined) return false;
  try {
    return llm.listProviders().some((p) => p && p.id === "openrouter");
  } catch (_) {
    return false;
  }
}

async function harnessVisionInfo() {
  const now = Date.now();
  if (visionInfoCache !== null && now - visionInfoCache.at < 30000) return visionInfoCache.value;
  const info = {
    available: false,
    supported: "unknown",
    provider: null,
    model: null,
    modalities: [],
    reason: null,
  };
  try {
    const selectionSvc = ctx.get("agentDefaultModel");
    const selection = selectionSvc && typeof selectionSvc.currentSelection === "function"
      ? selectionSvc.currentSelection()
      : null;
    if (!selection || !selection.provider || !selection.model) {
      info.reason = "no default model selection";
    } else {
      info.provider = String(selection.provider);
      info.model = String(selection.model);
      if (llm === undefined || typeof llm.resolveModelInfo !== "function") {
        info.reason = "llm service unavailable";
      } else {
        const resolved = await llm.resolveModelInfo(selection.provider, selection.model);
        const modalities = Array.isArray(resolved && resolved.inputModalities) ? resolved.inputModalities : [];
        info.modalities = modalities;
        if (modalities.length) {
          info.supported = "known";
          info.available = modalities.includes("image");
          if (!info.available) info.reason = "current model advertises text input only";
        } else {
          info.reason = "model did not advertise input modalities";
        }
      }
    }
  } catch (err) {
    info.reason = String((err && err.message) || err);
  }
  visionInfoCache = { at: now, value: info };
  return info;
}

  return { loadConfig, saveConfig, keyInfo, resolveKey, harnessRouteAvailable, harnessVisionInfo, invalidateVisionCache };
}
