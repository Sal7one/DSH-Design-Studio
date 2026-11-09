// Content search from a live node to Compose source: test tags (testTag/qaTag, literal or
// constant), visible text literals including Kotlin string templates, and Android string
// resources with their R.string usages. Every result is an unverified candidate: nothing here
// proves that the installed APK was built from these files.
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const SKIP = new Set(["build", ".git", ".gradle", ".idea", ".kotlin", "node_modules", "generated", "intermediates", ".cxx", "Pods", "DerivedData"]);
const MAX_FILES = 3000;
const MAX_BYTES = 512 * 1024;
const MAX_DEPTH = 14;
const CACHE_MS = 15000;
const cache = new Map();

const STRING = String.raw`"((?:[^"\\\n]|\\.)*)"`;
const TAG_CALL = new RegExp(String.raw`\b(?:testTag|qaTag)\s*\(\s*(?:tag\s*=\s*)?(?:` + STRING + String.raw`|([A-Za-z_][\w.]*))`, "g");
const TAG_ASSIGN = new RegExp(String.raw`\btestTag\s*=\s*(?:` + STRING + String.raw`|([A-Za-z_][\w.]*))`, "g");
const CONSTANT = new RegExp(String.raw`\bval\s+([A-Za-z_]\w*)\s*(?::\s*String\s*)?=\s*` + STRING, "g");
const LITERAL = new RegExp(STRING, "g");
const RESOURCE_USE = /\bR\.(string|plurals)\.([A-Za-z_]\w*)/g;
const RESOURCE = /<(string|plurals)\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/\1>/g;
const PLURAL_ITEM = /<item\b[^>]*>([\s\S]*?)<\/item>/g;

function unescapeKotlin(raw) {
  return raw.replace(/\\u([0-9a-fA-F]{4})|\\(.)/g, (_, hex, ch) => hex ? String.fromCharCode(parseInt(hex, 16))
    : ch === "n" ? "\n" : ch === "t" ? "\t" : ch === "r" ? "\r" : ch === "b" ? "\b" : ch);
}

function regexEscape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A Kotlin literal becomes a matcher; `$name` and `${…}` templates match any text in between.
function kotlinMatcher(raw) {
  const parts = [], holes = /\$\{[^}]*\}|\$[A-Za-z_][\w]*/g;
  let last = 0, statics = 0, match;
  while ((match = holes.exec(raw))) {
    if (match.index > 0 && raw[match.index - 1] === "\\") continue;
    const text = unescapeKotlin(raw.slice(last, match.index));
    statics += text.trim().length;
    parts.push(regexEscape(text), "[\\s\\S]+?");
    last = holes.lastIndex;
  }
  const tail = unescapeKotlin(raw.slice(last));
  if (!parts.length) return { exact: tail };
  statics += tail.trim().length;
  if (statics < 3) return null;
  parts.push(regexEscape(tail));
  return { pattern: new RegExp("^" + parts.join("") + "$", "i") };
}

function decodeXml(text) {
  let value = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<\/?(?:b|i|u|font|annotation|xliff:g)\b[^>]*>/g, "").trim();
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))).replace(/&amp;/g, "&")
    .replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\(['"@?\\])/g, "$1");
}

// An Android string resource becomes a matcher; %s, %1$d, %.2f and similar match any text.
function resourceMatcher(value) {
  const holes = /%(?:\d+\$)?[-#+ 0,(]*\d*(?:\.\d+)?[a-zA-Z%]/g;
  if (!holes.test(value)) return { exact: value };
  const statics = value.replace(holes, "").trim().length;
  if (statics < 3) return null;
  const pattern = value.split(holes).map(regexEscape).join("[\\s\\S]+?");
  return { pattern: new RegExp("^" + pattern + "$", "i") };
}

function lineAt(text, index) {
  let line = 1;
  for (let i = text.indexOf("\n"); i !== -1 && i < index; i = text.indexOf("\n", i + 1)) line++;
  return line;
}

function enclosingFunction(lines, line) {
  for (let i = line - 1; i >= 0 && i > line - 400; i--) {
    const found = /\bfun\s+(?:<[^>]*>\s*)?(?:[A-Za-z_][\w.]*\.)?([A-Za-z_]\w*)\s*\(/.exec(lines[i] || "");
    if (found) return found[1];
  }
  return "";
}

async function collect(root) {
  const kotlin = [], strings = [];
  let truncated = false;
  async function walk(dir, depth) {
    if (depth > MAX_DEPTH) { truncated = true; return; }
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (kotlin.length + strings.length >= MAX_FILES) { truncated = true; return; }
      if (entry.name.startsWith(".") || SKIP.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "test" || entry.name === "androidTest") continue;
        await walk(full, depth + 1);
      } else if (entry.isFile()) {
        if (entry.name.endsWith(".kt")) kotlin.push(full);
        else if (entry.name.endsWith(".xml") && /^values(?:-[\w+-]+)?$/.test(dir.split(sep).pop()) && dir.split(sep).includes("res")) strings.push(full);
      }
    }
  }
  await walk(root, 0);
  return { kotlin, strings, truncated };
}

async function readSmall(file) {
  try {
    const info = await stat(file);
    if (!info.isFile() || info.size > MAX_BYTES) return null;
    return await readFile(file, "utf8");
  } catch { return null; }
}

async function buildIndex(root) {
  const { kotlin, strings, truncated } = await collect(root);
  const files = [], literals = [], tags = [], constants = new Map(), resources = [], uses = new Map();
  for (const path of kotlin) {
    const text = await readSmall(path);
    if (text === null) continue;
    const file = { rel: relative(root, path).split(sep).join("/"), lines: text.split("\n") };
    const index = files.push(file) - 1;
    for (const m of text.matchAll(CONSTANT)) if (!constants.has(m[1])) constants.set(m[1], unescapeKotlin(m[2]));
    for (const re of [TAG_CALL, TAG_ASSIGN]) {
      for (const m of text.matchAll(re)) tags.push({ file: index, line: lineAt(text, m.index), raw: m[1], name: m[2] });
    }
    for (const m of text.matchAll(LITERAL)) {
      const matcher = m[1].trim() ? kotlinMatcher(m[1]) : null;
      if (matcher) literals.push({ file: index, line: lineAt(text, m.index), matcher });
    }
    for (const m of text.matchAll(RESOURCE_USE)) {
      const key = m[1] + ":" + m[2];
      if (!uses.has(key)) uses.set(key, []);
      uses.get(key).push({ file: index, line: lineAt(text, m.index) });
    }
  }
  for (const path of strings) {
    const text = await readSmall(path);
    if (text === null) continue;
    const rel = relative(root, path).split(sep).join("/");
    for (const m of text.matchAll(RESOURCE)) {
      const values = m[1] === "plurals" ? [...m[3].matchAll(PLURAL_ITEM)].map(item => item[1]) : [m[3]];
      for (const value of values) {
        const matcher = resourceMatcher(decodeXml(value));
        if (matcher) resources.push({ type: m[1], name: m[2], rel, line: lineAt(text, m.index), matcher });
      }
    }
  }
  for (const tag of tags) {
    if (tag.raw !== undefined) tag.matcher = kotlinMatcher(tag.raw);
    else {
      const value = constants.get(String(tag.name).split(".").pop());
      if (value !== undefined) { tag.matcher = { exact: value }; tag.via = tag.name; }
    }
  }
  return { files, literals, tags: tags.filter(tag => tag.matcher), resources, uses, truncated };
}

async function indexFor(root) {
  const cached = cache.get(root);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.index;
  const index = await buildIndex(root);
  cache.set(root, { at: Date.now(), index });
  if (cache.size > 4) cache.delete(cache.keys().next().value);
  return index;
}

function matches(matcher, value, { loose = false } = {}) {
  if (!matcher || typeof value !== "string" || !value.trim()) return false;
  const text = value.trim();
  if (matcher.exact !== undefined) return matcher.exact.trim() === text || (loose && matcher.exact.trim().toLowerCase() === text.toLowerCase());
  return matcher.pattern.test(text);
}

function candidate(index, ref, origin, match) {
  const file = index.files[ref.file];
  const from = Math.max(0, ref.line - 3), to = Math.min(file.lines.length, ref.line + 2);
  return { file: file.rel, line: ref.line, symbol: enclosingFunction(file.lines, ref.line), origin, match,
    status: "unverified", snippet: file.lines.slice(from, to).map(line => line.slice(0, 240)).join("\n") };
}

/**
 * Rank source locations that may render a node with this tag, text or description.
 * @param {string} root Android project root.
 * @param {{tag?: string, texts?: string[], descriptions?: string[]}} query Visible node facts.
 * @returns {Promise<{candidates: object[], truncated: boolean}>} At most 20 unverified candidates.
 */
export async function searchSource(root, { tag = "", texts = [], descriptions = [] } = {}) {
  const index = await indexFor(root);
  const out = [], seen = new Set();
  const push = (item) => {
    const key = item.file + ":" + item.line;
    if (seen.has(key) || out.length >= 20) return;
    seen.add(key);
    out.push(item);
  };
  if (tag) {
    for (const hit of index.tags) if (matches(hit.matcher, tag)) push(candidate(index, hit, hit.via ? "tag-constant" : "test-tag", tag));
  }
  const words = [...new Set([...texts, ...descriptions].filter(value => typeof value === "string" && value.trim()).map(value => value.trim()))].slice(0, 8);
  for (const loose of [false, true]) {
    for (const word of words) {
      for (const resource of index.resources) {
        if (!matches(resource.matcher, word, { loose })) continue;
        for (const use of index.uses.get(resource.type + ":" + resource.name) || []) {
          push({ ...candidate(index, use, "string-resource", word), resource: { name: resource.name, file: resource.rel, line: resource.line } });
        }
      }
      for (const literal of index.literals) if (matches(literal.matcher, word, { loose })) push(candidate(index, literal, "text-literal", word));
    }
    if (out.length) break;
  }
  return { candidates: out, truncated: index.truncated };
}

export function clearSourceSearchCache() {
  cache.clear();
}
