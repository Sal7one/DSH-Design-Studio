import { isSlug } from "./util.js";

// A design may contain several business pages. The original design stays at
// html/index.html (page id "index"); new pages are flat HTML entries under
// pages/<id>.html with their own CSS/JS and an optional token override.
const MANIFEST = "_studio/pages.json";
const DEFAULT_PAGE = "index";

function pageName(value, fallback) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return (text || fallback).slice(0, 80);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function defaultPage() {
  return {
    id: DEFAULT_PAGE,
    name: "Home",
    path: "html/index.html",
    css: "css/pages/index.css",
    tokens: "css/pages/index.tokens.css",
    js: "js/pages/index.js",
    createdAt: new Date().toISOString(),
  };
}

export function createPages({ fs, resolveSystem, readDesignJson, writeDesignJson, writeTextSafe, removePaths, bumpDesignStamp }) {
  async function readManifest(slug) {
    const raw = await readDesignJson(slug + "/" + MANIFEST);
    if (!raw || !Array.isArray(raw.pages) || !raw.pages.length) {
      return { version: 1, default: DEFAULT_PAGE, pages: [defaultPage()] };
    }
    const pages = raw.pages
      .filter((p) => p && ((p.id === DEFAULT_PAGE) || (isSlug(p.id) && typeof p.path === "string" && p.path.startsWith("pages/"))))
      .map((p) => ({
        id: String(p.id),
        name: pageName(p.name, p.id),
        path: String(p.path),
        css: p.css ? String(p.css) : "css/pages/" + p.id + ".css",
        tokens: p.tokens ? String(p.tokens) : "css/pages/" + p.id + ".tokens.css",
        js: p.js ? String(p.js) : "js/pages/" + p.id + ".js",
        createdAt: p.createdAt || null,
      }));
    if (!pages.some((p) => p.id === DEFAULT_PAGE)) pages.unshift(defaultPage());
    return {
      version: 1,
      default: raw.default && pages.some((p) => p.id === raw.default) ? raw.default : DEFAULT_PAGE,
      pages,
    };
  }

  async function saveManifest(slug, manifest) {
    await writeDesignJson(slug + "/" + MANIFEST, { version: 1, default: manifest.default || DEFAULT_PAGE, pages: manifest.pages });
  }

  async function systemPath(slug) {
    const sys = await resolveSystem(slug);
    if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
    return sys;
  }

  async function writeRel(slug, rel, content) {
    const sys = await systemPath(slug);
    const target = await fs.resolve(rel, { cwd: fs.processPath(sys) });
    if (!fs.contains(sys, target)) throw new Error("page path escapes the design system: " + rel);
    await writeTextSafe(target, content);
  }

  async function readRel(slug, rel) {
    const sys = await systemPath(slug);
    const target = await fs.resolve(rel, { cwd: fs.processPath(sys) });
    if (!fs.contains(sys, target)) throw new Error("page path escapes the design system: " + rel);
    if (!(await fs.stat(target))) return null;
    return fs.readText(target);
  }

  function tokenRel(id) {
    return "css/pages/" + id + ".tokens.css";
  }

  async function ensureTokenLink(slug, id) {
    const page = (await readManifest(slug)).pages.find((p) => p.id === id);
    if (!page) throw new Error("unknown page: " + id);
    const existing = await readRel(slug, page.path);
    if (existing === null) throw new Error("page file is missing: " + page.path);
    const token = tokenRel(id);
    if (!(await readRel(slug, token))) {
      await writeRel(slug, token, ":root {\n  /* page-scoped token overrides */\n}\n");
    }
    if (/data-ds-page-tokens|data-page-tokens/.test(existing) || existing.includes("../" + token)) return page;
    const link = '  <link rel="stylesheet" href="../' + token + '" data-ds-page-tokens>\n';
    const next = existing.includes("</head>")
      ? existing.replace("</head>", link + "</head>")
      : existing + "\n" + link;
    await writeRel(slug, page.path, next);
    return page;
  }

  function pageTemplate(id, name) {
    return [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '  <meta charset="utf-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1">',
      "  <title>" + escapeHtml(name) + "</title>",
      '  <link rel="stylesheet" href="../css/token.css">',
      '  <link rel="stylesheet" href="../css/style.css">',
      '  <link rel="stylesheet" href="../css/pages/' + id + '.css">',
      '  <link rel="stylesheet" href="../css/pages/' + id + '.tokens.css" data-ds-page-tokens>',
      "</head>",
      "<body>",
      '  <div class="page" data-page-id="' + id + '">',
      '    <header class="masthead">',
      '      <div class="brand"><span class="brand-text"><span class="brand-name">' + escapeHtml(name) + '</span><span class="brand-sub">page · ' + id + '</span></span></div>',
      '    </header>',
      '    <main id="main">',
      '      <section class="panel">',
      "        <h1>" + escapeHtml(name) + "</h1>",
      "        <p>New page — add the business screen here.</p>",
      "      </section>",
      "    </main>",
      "  </div>",
      '  <script src="../js/pages/' + id + '.js"></script>',
      "</body>",
      "</html>",
      "",
    ].join("\n");
  }

  async function list(slug) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    const manifest = await readManifest(slug);
    return { slug, default: manifest.default, pages: manifest.pages };
  }

  async function create(slug, id, name) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    if (!isSlug(id) || id === DEFAULT_PAGE) throw new Error("pageId must match [a-z0-9][a-z0-9-]* and cannot be index");
    const manifest = await readManifest(slug);
    if (manifest.pages.some((p) => p.id === id)) throw new Error("page already exists: " + id);
    const page = {
      id,
      name: pageName(name, id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())),
      path: "pages/" + id + ".html",
      css: "css/pages/" + id + ".css",
      tokens: tokenRel(id),
      js: "js/pages/" + id + ".js",
      createdAt: new Date().toISOString(),
    };
    await writeRel(slug, page.path, pageTemplate(id, page.name));
    await writeRel(slug, page.css, "/* Page-specific layout for " + page.name + ". Keep shared tokens in css/token.css. */\n");
    await writeRel(slug, page.tokens, ":root {\n  /* page-scoped token overrides */\n}\n");
    await writeRel(slug, page.js, "// Presentation-only JS for " + page.name + ". No app logic, persistence, or fetches.\n");
    manifest.pages.push(page);
    manifest.default = manifest.default || DEFAULT_PAGE;
    await saveManifest(slug, manifest);
    await bumpDesignStamp(slug).catch(function () {});
    return page;
  }

  async function rename(slug, id, name) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    if (!isSlug(id)) throw new Error("invalid page id");
    const manifest = await readManifest(slug);
    const page = manifest.pages.find((p) => p.id === id);
    if (!page) throw new Error("unknown page: " + id);
    page.name = pageName(name, page.name);
    await saveManifest(slug, manifest);
    await bumpDesignStamp(slug).catch(function () {});
    return page;
  }

  async function remove(slug, id) {
    if (!isSlug(slug)) throw new Error("invalid slug");
    if (!isSlug(id) || id === DEFAULT_PAGE) throw new Error("the default page cannot be deleted");
    const manifest = await readManifest(slug);
    const page = manifest.pages.find((p) => p.id === id);
    if (!page) throw new Error("unknown page: " + id);
    const sys = await systemPath(slug);
    const sysPath = fs.processPath(sys);
    const targets = [];
    for (const rel of [page.path, page.css, page.tokens, page.js]) {
      const target = await fs.resolve(rel, { cwd: sysPath });
      if (fs.contains(sys, target) && (await fs.stat(target))) targets.push(fs.processPath(target));
    }
    if (targets.length) await removePaths(targets, sysPath);
    manifest.pages = manifest.pages.filter((p) => p.id !== id);
    if (manifest.default === id) manifest.default = DEFAULT_PAGE;
    await saveManifest(slug, manifest);
    await bumpDesignStamp(slug).catch(function () {});
    return { id, removed: true };
  }

  return { list, create, rename, remove, ensureTokenLink, tokenRel, readManifest };
}
