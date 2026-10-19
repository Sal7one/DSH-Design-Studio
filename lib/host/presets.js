import { LOGO_CAP } from "./constants.js";
import { cleanRel, isSlug } from "./util.js";

export function createPresets({ fs, resolveSystem, rootPath, readJson, writeJson, writeBytes, removePaths, bumpDesignStamp }) {

const PRESETS_DIR = "_presets";

const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|var\(--[\w-]+\)|[a-z]+)$/;

async function listPresets() {
  let entries = [];
  try {
    entries = await fs.listDir(await fs.resolve(PRESETS_DIR, { cwd: await rootPath() }));
  } catch (_) {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (e.type !== "file" || !e.name.includes(".json")) continue;
    try {
      const p = JSON.parse(await fs.readText(e.target));
      out.push({
        id: p.id || e.name.replace(/\.json$/, ""), name: p.name || p.id || e.name.replace(/\.json$/, ""),
        colors: p.colors && typeof p.colors === "object" ? p.colors : {},
        logos: p.logos && typeof p.logos === "object" ? p.logos : {},
        fonts: p.fonts && typeof p.fonts === "object" ? p.fonts : {},
        radius: p.radius ?? null, spacing: p.spacing ?? null,
        components: p.components && typeof p.components === "object" ? p.components : {},
        version: typeof p.version === "number" ? p.version : 1,
      });
    } catch (err) {
      out.push({ id: e.name.replace(/\.json$/, ""), name: e.name.replace(/\.json$/, ""), error: "unreadable: " + String((err && err.message) || err) });
    }
  }
  out.sort((a, b) => (a.id < b.id ? -1 : 1));
  return out;
}

function renderTokenCss(p) {
  const c = p.colors || {};
  const f = p.fonts || {};
  const lines = ["/* GENERATED from identity preset: " + p.id + " (do not hand-edit; regenerate on apply) */", ":root {"];
  for (const k of ["bg", "panel", "panel2", "border", "text", "muted", "accent", "ok", "warn", "err", "info"]) {
    if (typeof c[k] === "string") lines.push("  --" + k + ": " + c[k] + ";");
  }
  if (typeof p.radius === "string") lines.push("  --radius: " + p.radius + ";");
  if (typeof p.spacing === "number") lines.push("  --space: " + p.spacing + "px;");
  if (typeof f.body === "string") lines.push("  --font-body: " + f.body + ";");
  if (typeof f.display === "string") lines.push("  --font-display: " + f.display + ";");
  if (typeof f.mono === "string") lines.push("  --font-mono: " + f.mono + ";");
  lines.push("}");
  return lines.join("\n") + "\n";
}

function validatePreset(p) {
  if (!p || typeof p !== "object") throw new Error("preset must be an object");
  if (typeof p.id !== "string" || !isSlug(p.id)) throw new Error("preset id must match [a-z0-9][a-z0-9-]*");
  if (typeof p.name !== "string" || !p.name.trim()) throw new Error("preset name is required");
  if (!p.colors || typeof p.colors !== "object" || typeof p.colors.bg !== "string") throw new Error("preset needs at least colors.bg");
  for (const k of Object.keys(p.colors)) {
    if (typeof p.colors[k] !== "string" || !COLOR_RE.test(p.colors[k])) throw new Error("invalid color value for " + k);
  }
  if (p.radius !== undefined && p.radius !== null && typeof p.radius !== "string") throw new Error("radius must be a string (e.g. 12px)");
  if (p.spacing !== undefined && p.spacing !== null && typeof p.spacing !== "number") throw new Error("spacing must be a number (px)");
  return true;
}

async function savePreset(preset) {
  validatePreset(preset);
  const next = Object.assign({}, preset, { version: (typeof preset.version === "number" ? preset.version : 1) + 1 });
  await fs.writeText(await fs.resolve(PRESETS_DIR + "/" + preset.id + ".json", { cwd: await rootPath() }), JSON.stringify(next, null, 2));
  await fs.writeText(await fs.resolve(PRESETS_DIR + "/" + preset.id + ".token.css", { cwd: await rootPath() }), renderTokenCss(preset));
  return { id: next.id, name: next.name, version: next.version };
}

async function deletePreset(id) {
  if (!isSlug(id)) throw new Error("invalid preset id");
  const root = await rootPath();
  const jt = await fs.resolve(PRESETS_DIR + "/" + id + ".json", { cwd: root });
  const ct = await fs.resolve(PRESETS_DIR + "/" + id + ".token.css", { cwd: root });
  await removePaths([fs.processPath(jt), fs.processPath(ct)], root);
  return { id, removed: true };
}

async function applyPreset(slug, presetId) {
  if (!isSlug(slug)) throw new Error("invalid slug");
  if (!isSlug(presetId)) throw new Error("invalid preset id");
  const pt = await fs.resolve(PRESETS_DIR + "/" + presetId + ".json", { cwd: await rootPath() });
  if (!(await fs.stat(pt))) throw new Error("unknown preset: " + presetId);
  const preset = JSON.parse(await fs.readText(pt));
  const sys = await resolveSystem(slug);
  if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
  const rp = fs.processPath(sys);
  await fs.writeText(await fs.resolve("css/token.css", { cwd: rp }), renderTokenCss(preset));
  const logos = preset.logos && typeof preset.logos === "object" ? preset.logos : {};
  const copied = [];
  const missing = [];
  const presetRoot = await fs.resolve(PRESETS_DIR, { cwd: await rootPath() });
  for (const k of Object.keys(logos)) {
    const srcRel = cleanRel(String(logos[k]));
    if (srcRel === null) { missing.push(k + " (bad path)"); continue; }
    const src = await fs.resolve(srcRel, { cwd: fs.processPath(presetRoot) });
    const s = await fs.stat(src);
    if (!s || s.type !== "file") { missing.push(k + " (" + srcRel + " not found in the preset store)"); continue; }
    const dstRel = "assets/logos/" + srcRel.split("/").pop();
    try {
      const bytes = await fs.readBytes(src, undefined, LOGO_CAP);
      const dst = await fs.resolve(dstRel, { cwd: rp });
      await writeBytes(fs.processPath(dst), bytes);
      copied.push(dstRel);
    } catch (_) {
      missing.push(k + " (copy failed)");
    }
  }
  // token.css was overwritten above, so the design changed even with no logos.
  await bumpDesignStamp(slug).catch(function () {});
  return { slug, presetId, tokenCss: "css/token.css", copied, missing };
}

  return { listPresets, savePreset, deletePreset, applyPreset };
}
