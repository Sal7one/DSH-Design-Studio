import { createHash } from "node:crypto";
import { IMAGE_CAP } from "./constants.js";
import { dataUrlToBytes, cleanRel, isSlug, readPngSize } from "./util.js";

// Asset pipeline for a design system:
//   - files live under assets/images (raster) and assets/files (everything else)
//   - assets/assets.json is a durable manifest: mime, bytes, dimensions, sha256, alt
//   - listing is self-healing: files written by any tool are backfilled, deletions drop out
//   - uploads are deduplicated by sha256 and names are sanitized/unique
const ASSETS_DIR = "assets";
const MANIFEST = "assets/assets.json";
const MIME_BY_EXT = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".avif": "image/avif",
  ".txt": "text/plain", ".md": "text/markdown", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".pdf": "application/pdf", ".woff2": "font/woff2",
};
const EXT_BY_MIME = {
  "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif",
  "image/svg+xml": ".svg", "application/pdf": ".pdf",
};

function isPreviewName(name) {
  return /^preview(-[0-9]+)?\.png$/i.test(String(name));
}

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sniffMime(bytes, name) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  const head = new TextDecoder().decode(bytes.slice(0, 256)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  const ext = "." + (String(name).split(".").pop() || "").toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

function imageSize(bytes, mime) {
  try {
    if (mime === "image/png") return readPngSize(bytes);
    if (mime === "image/gif" && bytes.length >= 10) {
      return { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) };
    }
    if (mime === "image/jpeg" && bytes.length > 4) {
      let i = 2;
      while (i + 8 < bytes.length) {
        if (bytes[i] !== 0xff) { i++; continue; }
        const marker = bytes[i + 1];
        if (marker === 0xd8 || marker === 0xd9) { i += 2; continue; }
        const length = (bytes[i + 2] << 8) | bytes[i + 3];
        const isSof = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
        if (isSof) {
          return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
        }
        i += 2 + length;
      }
    }
    if (mime === "image/webp" && bytes.length >= 30) {
      const kind = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
      if (kind === "VP8X") {
        return {
          width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)),
          height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)),
        };
      }
    }
  } catch (_) {}
  return null;
}

function extForMime(mime) {
  return EXT_BY_MIME[mime] || "";
}

function sanitizeName(name, mime) {
  let base = String(name || "asset")
    .replace(/[\\/]/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .toLowerCase();
  if (!base) base = "asset";
  const current = /\.([a-z0-9]{1,8})$/.exec(base);
  const wanted = extForMime(mime);
  if (!current) base += wanted || "";
  else if (wanted && current[0] !== wanted) base = base.slice(0, -current[0].length) + wanted;
  if (base.length > 80) {
    const ext = (wanted || (current && current[0]) || "").slice(0, 8);
    base = base.slice(0, Math.max(1, 80 - ext.length)) + ext;
  }
  return base;
}

function kindDir(mime) {
  return mime.startsWith("image/") ? "images" : "files";
}

export function createAssets({ fs, rootPath, resolveSystem, readJson, writeJson, writeBytes, removePaths, bumpDesignStamp }) {
  async function readManifest(slug) {
    const parsed = await readJson(slug + "/" + MANIFEST);
    return parsed && typeof parsed === "object" && Array.isArray(parsed.assets)
      ? { version: 1, assets: parsed.assets }
      : { version: 1, assets: [] };
  }

  async function saveManifest(slug, manifest) {
    await writeJson(slug + "/" + MANIFEST, { version: 1, assets: manifest.assets });
  }

  async function walkFiles(slug) {
    const sys = await resolveSystem(slug);
    if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
    const root = await fs.resolve(ASSETS_DIR, { cwd: fs.processPath(sys) });
    if (!(await fs.stat(root))) return [];
    const files = [];
    async function walk(rel, target) {
      for (const entry of await fs.listDir(target)) {
        const nextRel = rel ? rel + "/" + entry.name : entry.name;
        if (entry.type === "directory") {
          await walk(nextRel, entry.target);
          continue;
        }
        if (!entry.name || entry.name === "assets.json" || isPreviewName(entry.name)) continue;
        files.push({ path: ASSETS_DIR + "/" + nextRel, name: entry.name, target: entry.target });
      }
    }
    await walk("", root);
    return files;
  }

  async function sync(slug) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    const manifest = await readManifest(slug);
    const previous = new Map(manifest.assets.map((asset) => [asset.path, asset]));
    const files = await walkFiles(slug);
    const next = [];
    let changed = false;
    for (const file of files) {
      let entry = previous.get(file.path);
      const bytes = await fs.readBytes(file.target, undefined, IMAGE_CAP);
      const hash = hashBytes(bytes);
      if (!entry) {
        const mime = sniffMime(bytes, file.name);
        const size = imageSize(bytes, mime);
        entry = {
          path: file.path,
          name: file.name,
          mime,
          bytes: bytes.length,
          width: size ? size.width : null,
          height: size ? size.height : null,
          hash,
          createdAt: new Date().toISOString(),
          alt: null,
        };
        changed = true;
      } else if (entry.hash !== hash || entry.bytes !== bytes.length) {
        entry = Object.assign({}, entry, { hash, bytes: bytes.length, mime: sniffMime(bytes, file.name) });
        const size = imageSize(bytes, entry.mime);
        entry.width = size ? size.width : null;
        entry.height = size ? size.height : null;
        changed = true;
      }
      next.push(entry);
      previous.delete(file.path);
    }
    if (previous.size) changed = true;
    if (changed) {
      next.sort((a, b) => (a.path < b.path ? -1 : 1));
      manifest.assets = next;
      await saveManifest(slug, manifest);
    }
    return manifest.assets;
  }

  async function storeAsset(slug, name, bytes, alt) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    if (!bytes || !bytes.length) throw new Error("asset is empty");
    if (bytes.length > IMAGE_CAP) throw new Error("asset is too large (max 12MB)");
    const sys = await resolveSystem(slug);
    if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
    const mime = sniffMime(bytes, name);
    const base = sanitizeName(name, mime);
    const hash = hashBytes(bytes);
    const manifest = await readManifest(slug);
    const duplicate = manifest.assets.find((asset) => asset.hash === hash);
    if (duplicate) {
      if (alt && duplicate.alt !== String(alt).slice(0, 300)) {
        duplicate.alt = String(alt).slice(0, 300);
        await saveManifest(slug, manifest);
      }
      return { asset: duplicate, duplicate: true };
    }

    let dest = ASSETS_DIR + "/" + kindDir(mime) + "/" + base;
    const exists = new Set(manifest.assets.map((asset) => asset.path));
    if (exists.has(dest) || (await fs.stat(await fs.resolve(dest, { cwd: fs.processPath(sys) })))) {
      const dot = base.lastIndexOf(".");
      const stem = dot > 0 ? base.slice(0, dot) : base;
      const ext = dot > 0 ? base.slice(dot) : "";
      dest = ASSETS_DIR + "/" + kindDir(mime) + "/" + stem + "-" + hash.slice(0, 8) + ext;
    }
    const target = await fs.resolve(dest, { cwd: fs.processPath(sys) });
    if (!fs.contains(sys, target)) throw new Error("path escapes the design system");
    await writeBytes(fs.processPath(target), bytes);
    const size = imageSize(bytes, mime);
    const asset = {
      path: dest,
      name: dest.split("/").pop(),
      mime,
      bytes: bytes.length,
      width: size ? size.width : null,
      height: size ? size.height : null,
      hash,
      createdAt: new Date().toISOString(),
      alt: alt ? String(alt).slice(0, 300) : null,
    };
    manifest.assets = manifest.assets.filter((item) => item.path !== dest).concat(asset);
    await saveManifest(slug, manifest);
    await bumpDesignStamp(slug).catch(function () {});
    return { asset, duplicate: false };
  }

  async function upload(slug, name, dataUrl, alt) {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) throw new Error("asset upload needs a data URL");
    const bytes = dataUrlToBytes(dataUrl);
    if (!bytes) throw new Error("could not decode the asset data URL");
    return storeAsset(slug, name || "asset", bytes, alt);
  }

  async function uploadFromPath(slug, sourcePath, name, alt) {
    if (typeof sourcePath !== "string" || !sourcePath) throw new Error("sourcePath is required");
    const source = await fs.resolve(sourcePath);
    const info = await fs.stat(source);
    if (!info || info.type !== "file") throw new Error("source file not found: " + sourcePath);
    const bytes = await fs.readBytes(source, undefined, IMAGE_CAP);
    return storeAsset(slug, name || String(sourcePath).split(/[\\/]/).pop() || "asset", bytes, alt);
  }

  async function remove(slug, assetPath) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    const rel = cleanRel(assetPath);
    if (!rel || !rel.startsWith(ASSETS_DIR + "/") || rel === MANIFEST) throw new Error("invalid asset path");
    const sys = await resolveSystem(slug);
    const target = await fs.resolve(rel, { cwd: fs.processPath(sys) });
    if (!fs.contains(sys, target)) throw new Error("path escapes the design system");
    await removePaths([fs.processPath(target)], await rootPath());
    const manifest = await readManifest(slug);
    manifest.assets = manifest.assets.filter((asset) => asset.path !== rel);
    await saveManifest(slug, manifest);
    await bumpDesignStamp(slug).catch(function () {});
    return { removed: rel };
  }

  return { list: sync, sync, upload, uploadFromPath, remove };
}
