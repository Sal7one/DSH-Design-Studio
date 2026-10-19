import { IMAGE_CAP, VISION_COOLDOWN_MS } from "./constants.js";
import { MIME_BY_EXT, bytesToB64, dataUrlToBytes, isSlug } from "./util.js";

export function createVision({ fs, llm, attachments, resolveInSystem, writeJson, loadConfig, resolveKey, harnessVisionInfo }) {
  const visionCooldown = new Map();
  const contextCache = new Map();

function buildPrompt(brief, style) {
  const reviewStyle = style === "balanced" || style === "lenient" ? style : "strict";
  const judgement = reviewStyle === "lenient"
    ? "POOR only if the screen is clearly broken or unusable (overlapping, cut off, unreadable, or visually empty). GOOD if a real user could use it comfortably."
    : reviewStyle === "balanced"
      ? "POOR for clear visual defects or an unfinished look; GOOD for a coherent, cleanly laid-out mockup that matches the brief."
      : "POOR if it looks like an unstyled/plain list, has no real colour or visual hierarchy, uses placeholder/lorem text, has overlapping/cut-off/misaligned elements, or is otherwise something a user would call ugly or broken. GOOD if it looks like a real, cleanly laid-out app that matches what was asked.";
  return [
    "You are a mobile/web UI reviewer. The attached screenshot is the final screen of an app built to this brief:",
    '"""' + String(brief).slice(0, 900) + '"""', "",
    "Judge ONLY the visual quality against the brief. " + judgement, "",
    "Reply in EXACTLY this shape, nothing else:", "VERDICT: GOOD|POOR",
    "<one short sentence naming the specific visual strengths or problems you see>",
  ].join("\n");
}

function parseVisualVerdict(text) {
  const t = String(text || "").trim();
  const m = /verdict\s*[:\-]?\s*(good|poor|pass|fail)/i.exec(t);
  const token = (m ? m[1] : (/\bgood\b/i.test(t) && !/\bpoor\b/i.test(t) ? "good" : /\bpoor\b/i.test(t) ? "poor" : "")).toLowerCase();
  const ok = token === "good" || token === "pass";
  const notes = t.replace(/verdict\s*[:\-]?\s*(good|poor|pass|fail)\s*[.\-:—–]?/i, "").replace(/^[\s—–.:\-]+/, "").replace(/\s+/g, " ").trim().slice(0, 260);
  return { ok, notes: notes || (ok ? "looks acceptable" : "no specifics given") };
}

function flattenContent(content, reasoning) {
  if (typeof content === "string") return content.trim() ? content : reasoning ? String(reasoning) : "";
  if (Array.isArray(content)) {
    const joined = content.map((c) => (c && typeof c === "object" && typeof c.text === "string" ? c.text : "")).join(" ");
    return joined.trim() ? joined : reasoning ? String(reasoning) : "";
  }
  return reasoning ? String(reasoning) : "";
}

function openRouterBase(options) {
  return String(options.baseUrl || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
}

async function fetchJson(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, Object.assign({}, init || {}, { signal: controller.signal }));
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}
    return { status: res.status, ok: res.ok, text, json };
  } catch (err) {
    return {
      status: 0,
      ok: false,
      text: "",
      json: null,
      error: controller.signal.aborted ? "timed out" : String((err && err.message) || err),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function modelContextLength(model, options, key) {
  const encoded = String(model).split("/").map(encodeURIComponent).join("/");
  const r = await fetchJson(openRouterBase(options) + "/models/" + encoded, {
    headers: { authorization: "Bearer " + key },
  }, 30000);
  if (!r.ok || !r.json) return undefined;
  const d = r.json.data;
  const n = d && (typeof d.context_length === "number"
    ? d.context_length
    : d.top_provider && typeof d.top_provider.context_length === "number" ? d.top_provider.context_length : null);
  return typeof n === "number" ? n : undefined;
}

async function callOpenRouter(model, prompt, cfg, key, imageUrls, maxCap, temperature) {
  const options = cfg.options || {};
  let ctxLen = contextCache.get(model);
  if (typeof ctxLen !== "number") {
    ctxLen = await modelContextLength(model, options, key);
    if (typeof ctxLen === "number") contextCache.set(model, ctxLen);
  }
  const cap = typeof maxCap === "number" && maxCap > 0
    ? maxCap
    : (typeof options.maxTokens === "number" && options.maxTokens > 0 ? options.maxTokens : 512);
  const fitted = typeof ctxLen === "number" && ctxLen > 0 ? Math.max(64, Math.min(cap, ctxLen - 8000)) : Math.min(cap, 8192);
  const images = Array.isArray(imageUrls)
    ? imageUrls.filter((u) => typeof u === "string" && u.startsWith("data:image/")).slice(0, 3)
    : typeof imageUrls === "string" && imageUrls.startsWith("data:image/") ? [imageUrls] : [];
  const content = images.length
    ? [{ type: "text", text: prompt }].concat(images.map((u) => ({ type: "image_url", image_url: { url: u } })))
    : prompt;
  const body = {
    model,
    temperature: typeof temperature === "number" ? temperature : (typeof options.temperature === "number" ? options.temperature : 0),
    max_tokens: fitted,
    messages: [{ role: "user", content }],
  };
  if (options.includeUsage) body.include_usage = true;
  if (cfg.effort && cfg.effort !== "off" && cfg.effort !== "auto") {
    body.reasoning = { effort: cfg.effort === "max" ? "high" : cfg.effort };
    if (options.reasoningExclude) body.reasoning.exclude = true;
  }
  if (options.providerRouting) {
    const routing = {
      sort: "throughput",
      quantizations: Array.isArray(options.quantizations) && options.quantizations.length
        ? options.quantizations
        : ["fp8", "bf16", "fp16", "fp32", "unknown"],
    };
    if (Array.isArray(options.onlyProviders) && options.onlyProviders.length) routing.only = options.onlyProviders;
    if (options.allowFallbacks === false) routing.allow_fallbacks = false;
    body.provider = routing;
  }
  const res = await fetchJson(openRouterBase(options) + "/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + key,
    },
    body: JSON.stringify(body),
  }, 130000);
  if (res.error) return { error: "request failed: " + res.error };
  if (res.status === 401 || res.status === 403) {
    return { error: "auth failed (HTTP " + res.status + ") — check the OPENROUTER_API_KEY value", fatal: true };
  }
  if (res.status === 429) return { error: "rate limited (HTTP 429)" };
  if (res.status >= 500) return { error: "provider error (HTTP " + res.status + ")" };
  if (res.status !== 200) {
    return { error: "HTTP " + res.status + (res.text ? ": " + String(res.text).slice(0, 160) : "") };
  }
  if (!res.json) return { error: "non-JSON response" };
  const choice = res.json.choices && res.json.choices[0];
  const msg = choice && choice.message;
  const text = msg && typeof msg === "object" ? flattenContent(msg.content, msg.reasoning || msg.reasoning_content) : "";
  if (!text || !String(text).trim()) return { error: "empty model output" };
  return { content: String(text), model: res.json.model || model, usage: res.json.usage || null };
}

async function reviewOnce(model, dataUrl, prompt, cfg, key) {
  return await callOpenRouter(model, prompt, cfg, key, [dataUrl], 512, 0);
}

async function harnessVisionOnce(dataUrl, prompt, cfg) {
  const info = await harnessVisionInfo();
  if (!info.available) return { error: "harness model does not advertise image input" + (info.reason ? " (" + info.reason + ")" : "") };
  if (llm === undefined || typeof llm.stream !== "function") return { error: "llm service unavailable" };
  if (attachments === undefined || typeof attachments.saveImage !== "function") return { error: "attachment service unavailable" };
  const bytes = dataUrlToBytes(dataUrl);
  if (!bytes) return { error: "malformed image data" };
  const mediaType = (String(dataUrl).match(/^data:([^;]+);base64,/i) || [])[1] || "image/png";
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mediaType)) {
    return { error: "unsupported image type for harness vision: " + mediaType };
  }
  let ref;
  try {
    ref = await attachments.saveImage({ data: bytes, mediaType, name: "design-studio-review" });
  } catch (err) {
    return { error: "could not attach the image: " + String((err && err.message) || err) };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  let text = "";
  let reasoning = "";
  let failure = null;
  try {
    const options = {
      provider: info.provider,
      model: info.model,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image", attachment: ref },
        ],
      }],
      temperature: 0,
      maxTokens: 512,
      signal: controller.signal,
    };
    if (cfg.effort && cfg.effort !== "off" && cfg.effort !== "auto") options.reasoningEffort = cfg.effort;
    for await (const chunk of llm.stream(options)) {
      if (!chunk) continue;
      if (chunk.type === "text-delta") text += chunk.text;
      else if (chunk.type === "reasoning-delta") reasoning += chunk.text;
      else if (chunk.type === "finish") {
        if (chunk.reason && (chunk.reason.kind === "error" || chunk.reason.kind === "aborted")) {
          failure = (chunk.reason.failure && chunk.reason.failure.message) || chunk.reason.kind;
        }
      }
    }
  } catch (err) {
    failure = controller.signal.aborted ? "timed out" : String((err && err.message) || err);
  } finally {
    clearTimeout(timer);
  }
  if (failure) return { error: "harness vision failed: " + failure };
  const out = String(text || "").trim() || String(reasoning || "").trim();
  if (!out) return { error: "harness vision returned no text" };
  return {
    content: out,
    model: info.provider + "/" + info.model,
    usage: null,
    transport: "harness",
  };
}

async function visionReview(args) {
  try {
    const slug = args && args.slug;
    if (!isSlug(slug)) return { ok: false, notes: "invalid slug", model: null };
    const cfg = await loadConfig();
    const models = cfg.visionModels;
    const transportPref = cfg.visionTransport || "auto";
    let dataUrl = null;
    const image = args && args.image;
    if (typeof image === "string" && image.startsWith("data:image/")) {
      if (image.length > IMAGE_CAP) return { ok: false, notes: "image too large (>12MB decoded)", model: null };
      dataUrl = image;
    } else if (typeof image === "string" && image.length) {
      const t = await resolveInSystem(slug, image);
      const info = await fs.stat(t);
      if (!info || info.type !== "file") return { ok: false, notes: "image not found: " + image, model: null };
      if ((info.size || 0) === 0) return { ok: false, notes: "image is empty (0 bytes): " + image + " — re-upload it", model: null };
      const bytes = await fs.readBytes(t, undefined, IMAGE_CAP);
      const ext = "." + (String(image).split(".").pop() || "png").toLowerCase();
      dataUrl = "data:" + (MIME_BY_EXT[ext] || "image/png") + ";base64," + bytesToB64(bytes);
    } else {
      return { ok: false, notes: "no image provided — drop an image into the design system or pass an image path", model: null };
    }
    let brief = args && typeof args.brief === "string" && args.brief.trim() ? args.brief : slug;
    try {
      const t = await resolveInSystem(slug, "design_prompts_forcoders.md");
      const text = await fs.readText(t);
      brief = String(text).slice(0, 2000);
    } catch (_) {}
    const prompt = buildPrompt(brief, cfg.reviewStyle);

    // Prefer the harness model when it advertises image input. This avoids a
    // separate OpenRouter key/model entirely on vision-capable routes.
    const harness = await harnessVisionInfo();
    let harnessError = null;
    if (transportPref !== "openrouter" && harness.available) {
      const r = await harnessVisionOnce(dataUrl, prompt, cfg);
      if (!r.error) {
        const verdict = parseVisualVerdict(r.content);
        const review = {
          slug,
          ok: verdict.ok,
          notes: verdict.notes,
          model: r.model,
          at: new Date().toISOString(),
          usage: r.usage,
          transport: r.transport,
        };
        try { await writeJson("_studio/reviews/" + slug + ".json", review); } catch (_) {}
        return { ok: verdict.ok, notes: verdict.notes, model: r.model, transport: r.transport, usage: r.usage };
      }
      harnessError = r.error;
      if (transportPref === "harness") {
        return { ok: false, notes: r.error, model: harness.model, transport: "harness" };
      }
    } else if (transportPref === "harness") {
      return {
        ok: false,
        notes: "harness vision unavailable: " + (harness.reason || "current model did not advertise image input"),
        model: harness.model,
        transport: "harness",
      };
    }

    if (!models.length) {
      return {
        ok: false,
        notes: "no vision model configured" + (harnessError ? " (harness: " + harnessError + ")" : ""),
        model: null,
      };
    }
    const key = await resolveKey();
    if (!key) {
      return {
        ok: false,
        notes: (harnessError ? "harness vision failed: " + harnessError + "; " : "") +
          "OpenRouter key not configured (credential reference OPENROUTER_API_KEY)",
        model: null,
        transport: "fetch",
      };
    }
    const now = Date.now();
    const hot = models.filter((m) => (visionCooldown.get(m) || 0) <= now);
    const tryList = hot.length ? hot : models;
    for (const m of tryList) {
      const r = await reviewOnce(m, dataUrl, prompt, cfg, key);
      if (r.error) {
        visionCooldown.set(m, Date.now() + VISION_COOLDOWN_MS);
        if (r.fatal) return { ok: false, notes: r.error, model: m, transport: "fetch" };
        continue;
      }
      visionCooldown.delete(m);
      const verdict = parseVisualVerdict(r.content);
      const review = { slug, ok: verdict.ok, notes: verdict.notes, model: r.model, at: new Date().toISOString(), usage: r.usage, transport: "fetch" };
      try { await writeJson("_studio/reviews/" + slug + ".json", review); } catch (_) {}
      return { ok: verdict.ok, notes: verdict.notes, model: r.model, transport: "fetch", usage: r.usage };
    }
    return {
      ok: false,
      notes: "all vision models failed (cooling or unreachable): " + models.join(", ") +
        (harnessError ? " (harness: " + harnessError + ")" : ""),
      model: null,
      transport: "fetch",
    };
  } catch (err) {
    return { ok: false, notes: String((err && err.message) || err), model: null };
  }
}

async function loadMentionedImages(slug, mentioned) {
  const loaded = [];
  for (const p of mentioned.slice(0, 2)) {
    try {
      const t = await resolveInSystem(slug, p);
      const info = await fs.stat(t);
      if (!info || info.type !== "file") {
        loaded.push({ path: p, error: "the file is not readable" });
        continue;
      }
      if ((info.size || 0) === 0) {
        loaded.push({ path: p, error: "the file is empty (0 bytes)" });
        continue;
      }
      const bytes = await fs.readBytes(t, undefined, IMAGE_CAP);
      const ext = "." + (String(p).split(".").pop() || "png").toLowerCase();
      loaded.push({ path: p, bytes, mediaType: MIME_BY_EXT[ext] || "image/png" });
    } catch (err) {
      loaded.push({ path: p, error: String((err && err.message) || err) });
    }
  }
  return loaded;
}

async function describeAttachedImages(slug, mentioned, message) {
  if (!mentioned.length) return "";
  const cfg = await loadConfig();
  const key = await resolveKey();
  const images = await loadMentionedImages(slug, mentioned);
  const notes = [];
  // One vision description PER image, written in the context of the operator's
  // request, so the child agent can't confuse the picker selection with
  // whatever image the design files already reference. This is the fallback
  // path when the harness model cannot accept images directly.
  for (const img of images) {
    if (img.error) {
      notes.push("- " + img.path + ": " + img.error + " — say so and ask the operator to re-upload.");
      continue;
    }
    if (img.mediaType === "image/svg+xml") {
      notes.push("- " + img.path + ": SVG is not a raster image; reason from the file itself and say so.");
      continue;
    }
    if (!key || !cfg.visionModels.length) {
      notes.push("- " + img.path + ": no vision model is configured, so you cannot see pixels; reason from the design files and say so.");
      continue;
    }
    const dataUrl = "data:" + img.mediaType + ";base64," + bytesToB64(img.bytes);
    const visPrompt = [
      'The design-studio operator is asking: """' + String(message || "").slice(0, 300) + '"""',
      "The attached image is " + img.path + " — the operator EXPLICITLY selected it in the studio image picker.",
      "Describe it FACTUALLY for a coding agent that cannot see it, in terms that help fulfil the request above: dominant background colors with hex approximations, accent colors, overall mood, layout zones (top to bottom), and anything to preserve (logos, patterns, text placement).",
      "Under 140 words, plain text, no markdown fences.",
    ].join("\n");
    let desc = null;
    let descModel = null;
    for (const m of cfg.visionModels) {
      const r = await textOnce(m, visPrompt, cfg, key, [dataUrl]);
      if (!r.error) {
        desc = r.content;
        descModel = r.model;
        break;
      }
    }
    notes.push("- " + img.path + (desc ? " (described by " + descModel + "): " + desc : ": the vision model could not describe it; reason from the design files and say so."));
  }
  return [
    "## The operator SELECTED these image(s) in the studio image picker this turn (in selection order):",
    notes.join("\n"),
    'When the operator says "the image", "this image", or "the background image" without a filename, they mean the FIRST selected image above — prefer it over any other asset already referenced in the files.',
  ].join("\n");
}

async function textOnce(model, prompt, cfg, key, imageUrls) {
  const options = cfg.options || {};
  const cap = options.maxTokens && options.maxTokens > 0 ? Math.min(options.maxTokens, 4096) : 900;
  const temperature = typeof options.temperature === "number" ? options.temperature : 0.3;
  return await callOpenRouter(model, prompt, cfg, key, imageUrls, cap, temperature);
}

  return { visionReview, describeAttachedImages, loadMentionedImages };
}
