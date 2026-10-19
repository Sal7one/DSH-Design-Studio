import { createHash, randomUUID } from "node:crypto";
import { isSlug } from "./util.js";

// Content-addressed edit history for one design system:
//   _studio/history/<slug>/objects/<sha256>   file blobs
//   _studio/history/<slug>/trees/<sha256>.json sorted {path, hash, size} trees
//   _studio/history/<slug>/index.json         snapshot nodes + head cursor
//
// Snapshots form a parent-linked tree. Restoring moves the head cursor and
// writes the tree; it never destroys later snapshots, so the older state can
// be restored again. Auto-capture is debounced by the host change detector.
const HISTORY_ROOT = "_studio/history";
const MAX_BLOB = 16 * 1024 * 1024;
const PREVIEW_RE = /^assets\/images\/preview(-[0-9]+)?\.png$/i;

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function isExcluded(path) {
  return path === "EDIT_REQUEST.md" || PREVIEW_RE.test(path);
}

export function createHistory({ fs, rootPath, resolveSystem, readJson, writeJson, writeBytes, removePaths, bumpDesignStamp }) {
  const locks = new Map();

  function withLock(slug, fn) {
    const prev = locks.get(slug) || Promise.resolve();
    const next = prev.then(fn, fn);
    locks.set(slug, next.catch(function () {}));
    return next;
  }

  function indexPath(slug) {
    return HISTORY_ROOT + "/" + slug + "/index.json";
  }

  async function loadIndex(slug) {
    const raw = await readJson(indexPath(slug));
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.snapshots)) {
      return { version: 1, slug, head: null, seq: 0, snapshots: [] };
    }
    if (!raw.head) raw.head = null;
    if (!Number.isFinite(raw.seq)) raw.seq = raw.snapshots.length;
    return raw;
  }

  async function saveIndex(slug, index) {
    await writeJson(indexPath(slug), index);
  }

  async function walkDesign(slug) {
    const sys = await resolveSystem(slug);
    if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
    const files = [];
    async function walk(rel, target) {
      for (const entry of await fs.listDir(target)) {
        const path = rel ? rel + "/" + entry.name : entry.name;
        if (entry.type === "directory") {
          await walk(path, entry.target);
          continue;
        }
        if (isExcluded(path)) continue;
        files.push({ path, target: entry.target });
      }
    }
    await walk("", sys);
    files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return files;
  }

  async function buildTree(slug) {
    const base = HISTORY_ROOT + "/" + slug;
    const entries = [];
    for (const file of await walkDesign(slug)) {
      const bytes = await fs.readBytes(file.target, undefined, MAX_BLOB);
      const hash = sha256(bytes);
      const blobRel = base + "/objects/" + hash;
      const blobTarget = await fs.resolve(blobRel, { cwd: await rootPath() });
      if (!(await fs.stat(blobTarget))) await writeBytes(fs.processPath(blobTarget), bytes);
      entries.push({ path: file.path, hash, size: bytes.length });
    }
    const tree = { version: 1, entries };
    const treeHash = sha256(JSON.stringify(tree));
    await writeJson(base + "/trees/" + treeHash + ".json", tree);
    return { tree, treeHash };
  }

  async function captureUnlocked(slug, reason, options) {
    const force = !!(options && options.force);
    const index = await loadIndex(slug);
    const head = index.snapshots.find((snap) => snap.id === index.head) || null;
    const built = await buildTree(slug);
    if (head && head.tree === built.treeHash && !force) {
      return { snapshot: head, duplicate: true, head: index.head };
    }
    const snapshot = {
      id: randomUUID(),
      seq: (index.seq || 0) + 1,
      at: new Date().toISOString(),
      reason: String(reason || "auto").slice(0, 160),
      tree: built.treeHash,
      files: built.tree.entries.length,
      parent: index.head || null,
    };
    index.seq = snapshot.seq;
    index.snapshots.push(snapshot);
    index.head = snapshot.id;
    await saveIndex(slug, index);
    return { snapshot, duplicate: false, head: index.head };
  }

  async function restoreUnlocked(slug, snapshotId, options) {
    let index = await loadIndex(slug);
    const target = index.snapshots.find((snap) => snap.id === snapshotId);
    if (!target) throw new Error("unknown snapshot: " + snapshotId);
    if (!(options && options.skipCapture)) {
      await captureUnlocked(slug, "before-restore");
      index = await loadIndex(slug);
    }
    const tree = await readJson(HISTORY_ROOT + "/" + slug + "/trees/" + target.tree + ".json");
    if (!tree || !Array.isArray(tree.entries)) throw new Error("snapshot tree is missing: " + target.tree);
    const sys = await resolveSystem(slug);
    const sysPath = fs.processPath(sys);
    const targetPaths = new Set(tree.entries.map((entry) => entry.path));
    const current = await walkDesign(slug);
    const remove = current.filter((file) => !targetPaths.has(file.path)).map((file) => fs.processPath(file.target));
    if (remove.length) await removePaths(remove, await rootPath());
    for (const entry of tree.entries) {
      const blob = await fs.resolve(HISTORY_ROOT + "/" + slug + "/objects/" + entry.hash, { cwd: await rootPath() });
      const bytes = await fs.readBytes(blob, undefined, MAX_BLOB);
      const dest = await fs.resolve(entry.path, { cwd: sysPath });
      if (!fs.contains(sys, dest)) throw new Error("snapshot path escapes the design system: " + entry.path);
      await writeBytes(fs.processPath(dest), bytes);
    }
    index.head = target.id;
    await saveIndex(slug, index);
    await bumpDesignStamp(slug).catch(function () {});
    return { restored: target.id, seq: target.seq, files: target.files, tree: target.tree, head: target.id };
  }

  async function capture(slug, reason, options) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    return withLock(slug, () => captureUnlocked(slug, reason, options));
  }

  async function list(slug) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    let index = await loadIndex(slug);
    if (index.snapshots.length === 0) {
      await capture(slug, "baseline");
      index = await loadIndex(slug);
    }
    return {
      slug,
      head: index.head,
      count: index.snapshots.length,
      snapshots: index.snapshots.map((snap) => Object.assign({}, snap, { current: snap.id === index.head })),
    };
  }

  async function restore(slug, snapshotId) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    return withLock(slug, () => restoreUnlocked(slug, snapshotId));
  }

  async function undo(slug) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    return withLock(slug, async () => {
      let index = await loadIndex(slug);
      await captureUnlocked(slug, "before-undo");
      index = await loadIndex(slug);
      const head = index.snapshots.find((snap) => snap.id === index.head);
      if (!head) throw new Error("no snapshots yet");
      if (!head.parent) throw new Error("already at the oldest snapshot");
      return restoreUnlocked(slug, head.parent, { skipCapture: true });
    });
  }

  return { list, capture, restore, undo };
}
