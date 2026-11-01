// Source adapters for the Android app editor.
//
// The editor talks to one graph contract. An adapter declares what it can
// expose and returns only facts it can prove from source. When no adapter
// understands the project, the runtime adapter is used: the Appium tree and
// screenshots still work, but components/routes/tokens are explicitly
// unsupported rather than guessed.
//
// XML/Views are not implemented. A new framework is added by writing another
// adapter, not by teaching the core about that framework.

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const SKIP = new Set([
  "build", ".git", ".gradle", ".idea", ".kotlin", "node_modules",
  "generated", "intermediates", ".eva", "Pods", "DerivedData",
]);
const CACHE = new Map();
const MAX_FILES = 800;
const MAX_BYTES = 512 * 1024;

export function runtimeAdapter(reason) {
  return {
    id: "runtime",
    label: "Runtime only",
    capabilities: { source: false, components: false, routes: false, tokens: false },
    reason: reason || "No supported source adapter was detected; showing the live accessibility tree.",
  };
}

export function composeAdapter() {
  return {
    id: "compose",
    label: "Jetpack Compose",
    capabilities: { source: true, components: true, routes: true, tokens: true },
    reason: "",
  };
}

function relative(root, full) {
  return full.startsWith(root) ? full.slice(root.length).replace(/^\/+/, "") : full;
}

async function scanSource(root) {
  const files = [];
  async function walk(dir, depth) {
    if (files.length >= MAX_FILES || depth > 10) return;
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) break;
      if (SKIP.has(entry.name) || (entry.name.startsWith(".") && entry.name !== ".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
      } else if (entry.isFile() && /\.(kt|kts)$/.test(entry.name)) {
        try {
          const info = await stat(full);
          if (info.size > MAX_BYTES) continue;
          files.push({ path: full, text: await readFile(full, "utf8") });
        } catch (_) {}
      }
    }
  }
  await walk(root, 0);
  return files;
}

function parseCompose(root, files) {
  const constants = new Map();
  const declRe = /\b(?:const\s+)?val\s+(\w+)\s*=\s*"([^"]*)"/g;
  const tagRe = /\.testTag\(\s*"([^"]+)"\s*\)/g;
  const navRe = /(composable|navigation)\(\s*route\s*=\s*([A-Za-z0-9_.]+|"[^"]*")/g;
  const colorRe = /\b(?:const\s+)?val\s+(\w+)\s*=\s*Color\(\s*(0x[0-9A-Fa-f]{8})\s*\)/g;

  for (const file of files) {
    const re = new RegExp(declRe.source, "g");
    let m;
    while ((m = re.exec(file.text))) constants.set(m[1], m[2]);
  }

  const components = [];
  const routes = [];
  const tokens = [];
  for (const file of files) {
    const local = new Map();
    const localRe = new RegExp(declRe.source, "g");
    let lm;
    while ((lm = localRe.exec(file.text))) local.set(lm[1], lm[2]);

    const lines = file.text.split("\n");
    const tagHits = [];
    const tagScan = new RegExp(tagRe.source, "g");
    let tm;
    while ((tm = tagScan.exec(file.text))) {
      const line = file.text.slice(0, tm.index).split("\n").length;
      tagHits.push({ tag: tm[1], line });
    }
    for (const hit of tagHits) {
      let fn = "";
      for (let i = hit.line - 1; i >= 0 && i > hit.line - 400; i -= 1) {
        const fm = /^(?:@\w+\s*)*(?:internal |private |public |protected )?fun\s+([A-Za-z_]\w*)\s*\(/.exec(lines[i] || "");
        if (fm) { fn = fm[1]; break; }
      }
      components.push({ tag: hit.tag, function: fn, file: relative(root, file.path), line: hit.line, usages: [] });
    }

    const navScan = new RegExp(navRe.source, "g");
    let nm;
    while ((nm = navScan.exec(file.text))) {
      const raw = nm[2];
      let resolved;
      if (raw.startsWith('"')) {
        resolved = raw.slice(1, -1);
      } else {
        const key = raw.includes(".") ? raw.split(".").pop() : raw;
        resolved = local.get(key) || constants.get(key) || raw;
      }
      routes.push({ kind: nm[1], route: resolved, file: relative(root, file.path) });
    }

    const colorScan = new RegExp(colorRe.source, "g");
    let cm;
    while ((cm = colorScan.exec(file.text))) {
      const line = file.text.slice(0, cm.index).split("\n").length;
      tokens.push({ name: cm[1], value: cm[2], file: relative(root, file.path), line });
    }
  }

  // Reuse detection is tag/function level: a tagged composable called from
  // several files is a shared component. It is not a full call graph.
  for (const component of components) {
    if (!component.function) continue;
    const useRe = new RegExp("\\b" + component.function.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\(", "g");
    for (const file of files) {
      let um;
      let count = 0;
      while ((um = useRe.exec(file.text)) && count < 20) {
        const line = file.text.slice(0, um.index).split("\n").length;
        component.usages.push({ file: relative(root, file.path), line });
        count += 1;
      }
    }
  }

  const seenRoutes = new Set();
  const uniqueRoutes = [];
  for (const route of routes) {
    if (seenRoutes.has(route.route)) continue;
    seenRoutes.add(route.route);
    uniqueRoutes.push(route);
  }

  return { components, routes: uniqueRoutes, tokens };
}

function emptyGraph(adapter) {
  return { adapter, files: 0, components: [], routes: [], tokens: [] };
}

export async function inspectProject(projectRoot) {
  if (!projectRoot) {
    return emptyGraph(runtimeAdapter("projectRoot is not configured; runtime tree only."));
  }
  const cached = CACHE.get(projectRoot);
  if (cached && Date.now() - cached.at < 30000) return cached.graph;

  let files = [];
  try { files = await scanSource(projectRoot); } catch (_) {}
  const hasCompose = files.some((file) => /@Composable|\.testTag\(|setContent\s*\{/.test(file.text));
  const adapter = hasCompose
    ? composeAdapter()
    : runtimeAdapter("No supported source markers found (Compose was the only source adapter).");
  const graph = hasCompose
    ? Object.assign({ adapter, files: files.length }, parseCompose(projectRoot, files))
    : Object.assign(emptyGraph(adapter), { files: files.length });
  CACHE.set(projectRoot, { at: Date.now(), graph });
  if (CACHE.size > 4) CACHE.delete(CACHE.keys().next().value);
  return graph;
}

export function tagContextFor(graph, tag) {
  if (!tag || !graph) return null;
  const definitions = (graph.components || []).filter((component) => component.tag === tag);
  if (!definitions.length) return { tag, definitions: [], usages: [] };
  const usages = [];
  for (const definition of definitions) {
    for (const usage of definition.usages || []) {
      usages.push(Object.assign({ function: definition.function }, usage));
    }
  }
  return { tag, definitions, usages: usages.slice(0, 40) };
}
