// Read-only claims from the experimental, debug-only QaLens auto-tag map.
import { createHash } from "node:crypto";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { inspectProject } from "./app-adapters.js";

const SKIP = new Set([".git", ".gradle", ".idea", ".kotlin", "node_modules", "build", "src", "generated", "intermediates"]);
const MAP_SUFFIX = "build/generated/qalens-source-map/debug/qalens/source-map.json";
const SHA = /^[0-9a-f]{64}$/;
const MAX_DIRS = 4000;
const MAX_MAPS = 64;
const MAX_MAP_BYTES = 4 * 1024 * 1024;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_ENTRIES = 20000;

function within(root, path) {
  const rel = relative(root, path);
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
function validEntry(entry) {
  return entry && typeof entry === "object" && SHA.test(entry.id) && SHA.test(entry.sourceSha256)
    && typeof entry.path === "string" && entry.path.length > 0 && entry.path.length <= 1024
    && !entry.path.includes("\\") && !isAbsolute(entry.path) && !entry.path.split("/").includes("..")
    && Number.isSafeInteger(entry.line) && entry.line > 0
    && typeof entry.alias === "string" && /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(entry.alias)
    && typeof entry.kind === "string" && entry.kind.length <= 128
    && typeof entry.symbol === "string" && entry.symbol.length <= 512;
}
async function discover(root) {
  const found = [];
  let dirs = 0, incomplete = false;
  async function walk(dir, depth) {
    if (++dirs > MAX_DIRS || depth > 12) { incomplete = true; return; }
    let children;
    try { children = await readdir(dir, { withFileTypes: true }); } catch { incomplete = true; return; }
    const buildLink = children.find((child) => child.name === "build" && child.isSymbolicLink());
    if (buildLink) incomplete = true;
    const build = children.find((child) => child.name === "build" && child.isDirectory());
    if (build) {
      const map = join(dir, MAP_SUFFIX);
      try {
        const info = await stat(map);
        if (!info.isFile() || info.size > MAX_MAP_BYTES || found.length >= MAX_MAPS) incomplete = true;
        else found.push({ moduleRoot: dir, file: map });
      } catch (error) {
        if (error.code !== "ENOENT" && error.code !== "ENOTDIR") incomplete = true;
      }
    }
    for (const child of children) {
      if (child.isDirectory() && !child.name.startsWith(".") && !SKIP.has(child.name)) {
        await walk(join(dir, child.name), depth + 1);
      }
    }
  }
  await walk(root, 0);
  return { found, incomplete };
}
async function loadMaps(root) {
  const { found, incomplete } = await discover(root);
  if (incomplete) return { entries: [], error: "Source-map discovery was incomplete; identity cannot be verified." };
  const entries = [];
  for (const item of found) {
    try {
      const actualMap = await realpath(item.file);
      if (!within(item.moduleRoot, actualMap) || !within(root, actualMap)) throw new Error("map path");
      const contents = await readFile(actualMap);
      if (contents.length > MAX_MAP_BYTES) throw new Error("map size");
      const data = JSON.parse(contents.toString("utf8"));
      if (data.schema !== "qalens.source-map" || data.version !== 1 || data.matching !== "node-reference-or-candidate"
        || typeof data.module !== "string" || !Array.isArray(data.entries)
        || data.entries.length + entries.length > MAX_ENTRIES || !data.entries.every(validEntry)) throw new Error("map schema");
      for (const entry of data.entries) entries.push({ ...entry, moduleRoot: item.moduleRoot });
    } catch {
      return { entries: [], error: "A source map is unreadable or unsupported; identity cannot be verified." };
    }
  }
  return { entries };
}
async function describe(root, entry) {
  const result = { file: relative(root, resolve(entry.moduleRoot, entry.path)).split(sep).join("/"), line: entry.line,
    sourceSha256: entry.sourceSha256, alias: entry.alias, symbol: entry.symbol, kind: entry.kind, origin: "source-map" };
  try {
    const file = await realpath(resolve(entry.moduleRoot, entry.path));
    if (!within(entry.moduleRoot, file) || !within(root, file)) return { ...result, status: "unavailable" };
    const info = await stat(file);
    if (!info.isFile() || info.size > MAX_SOURCE_BYTES) return { ...result, status: "unavailable" };
    const contents = await readFile(file);
    if (contents.length > MAX_SOURCE_BYTES) return { ...result, status: "unavailable" };
    if (createHash("sha256").update(contents).digest("hex") !== entry.sourceSha256) return { ...result, status: "stale" };
    const lines = contents.toString("utf8").split("\n");
    if (entry.line > lines.length) return { ...result, status: "unavailable" };
    const snippet = lines.slice(Math.max(0, entry.line - 3), Math.min(lines.length, entry.line + 2))
      .map((line) => line.slice(0, 240)).join("\n");
    return { ...result, status: "current", snippet };
  } catch {
    return { ...result, status: "unavailable" };
  }
}

/** Resolve one live node; verified means source-ref + current local map/hash, not APK build identity. */
export async function resolveSourceClaim({ projectRoot, sourceRef, tag } = {}) {
  if (typeof projectRoot !== "string" || !projectRoot.trim()) return { state: "unavailable", reason: "Configure the Android project root first.", candidates: [] };
  let root;
  try { root = await realpath(projectRoot); if (!(await stat(root)).isDirectory()) throw new Error("not a directory"); }
  catch { return { state: "unavailable", reason: "The Android project root is not accessible.", candidates: [] }; }
  const loaded = await loadMaps(root);
  if (loaded.error) return { state: "unavailable", reason: loaded.error, candidates: [] };
  const ref = typeof sourceRef === "string" ? sourceRef.trim() : "";
  const selectedTag = typeof tag === "string" ? tag.trim() : "";
  if (!ref && !selectedTag) return { state: "unavailable", reason: "The selected node has no source reference or tag.", candidates: [] };
  const matches = ref
    ? loaded.entries.filter((entry) => entry.id === ref)
    : loaded.entries.filter((entry) => selectedTag === entry.alias || selectedTag.endsWith(`_${entry.alias}`));
  const candidates = await Promise.all(matches.slice(0, 50).map((entry) => describe(root, entry)));
  if (!ref && selectedTag) {
    const graph = await inspectProject(root);
    for (const component of graph.components || []) {
      if (component.tag === selectedTag && candidates.length < 50) candidates.push({ file: component.file, line: component.line,
        symbol: component.function, origin: "manual-tag", status: "unverified" });
    }
  }
  if (!candidates.length) return { state: "unavailable", reason: ref ? "No local map entry matches this source reference." : "No local source candidate matches this tag.", candidates };
  if (candidates.length > 1) return { state: "ambiguous", reason: "Multiple source locations match; select a node with a unique source reference.", candidates: candidates.slice(0, 50) };
  const item = candidates[0];
  if (item.status === "stale") return { state: "stale", reason: "The current source hash differs from the generated map; rebuild the debug app and map.", candidates };
  if (item.status === "unavailable") return { state: "unavailable", reason: "The mapped source is inaccessible or outside its module.", candidates };
  if (ref && item.status === "current") return { state: "verified", reason: "Source reference and local source hash match the map. APK build identity is not independently verified.", candidates };
  return { state: "candidate", reason: "A tag or alias may match multiple runtime instances; no source reference proves this selection.", candidates };
}
