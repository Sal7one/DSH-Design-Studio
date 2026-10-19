import { IMAGE_CAP } from "./constants.js";
import { dirOf, readPngSize, waitForFile, isSlug } from "./util.js";

export function createPreview({ fs, webServer, resolveSystem, rootPath, ensureDir, removePaths, findBrowser, runBrowserScreenshot, loadConfig }) {

async function capturePreviewToSystem(slug) {
  if (!isSlug(slug)) throw new Error("invalid slug");
  const sys = await resolveSystem(slug);
  if (!(await fs.stat(sys))) throw new Error("unknown design system: " + slug);
  if (webServer === undefined || typeof webServer.getOrigin !== "function") {
    throw new Error("web server unavailable — cannot render the preview");
  }
  const browser = await findBrowser();
  if (browser === null) {
    throw new Error("no headless browser found — install Microsoft Edge, Google Chrome or Chromium to capture the preview");
  }
  const origin = webServer.getOrigin();
  const url = origin + "/design-studio/" + encodeURIComponent(slug) + "/html/index.html?capture=" + Date.now();
  const stamp = Date.now();
  const destRel = "assets/images/preview-" + stamp + ".png";
  const destTarget = await fs.resolve(destRel, { cwd: fs.processPath(sys) });
  if (!fs.contains(sys, destTarget)) throw new Error("path escapes the design system");
  const destAbs = fs.processPath(destTarget);
  await ensureDir(dirOf(destAbs));
  const profileRel = "_studio/.tmp/browser-" + stamp;
  const profileTarget = await fs.resolve(profileRel, { cwd: await rootPath() });
  const profileAbs = fs.processPath(profileTarget);
  await ensureDir(profileAbs);
  const cfg = await loadConfig();
  const captureWidth = cfg.capture && cfg.capture.width ? cfg.capture.width : 1440;
  const captureHeight = cfg.capture && cfg.capture.height ? cfg.capture.height : 1700;
  try {
    let result = await runBrowserScreenshot(browser, url, destAbs, profileAbs, "--headless=new", captureWidth, captureHeight, await rootPath());
    let info = await waitForFile(fs, destTarget, 4000);
    if (result.exitCode !== 0 || !info || (info.size || 0) === 0) {
      // Older Chromium builds only understand the original headless flag.
      result = await runBrowserScreenshot(browser, url, destAbs, profileAbs, "--headless", captureWidth, captureHeight, await rootPath());
      info = await waitForFile(fs, destTarget, 8000);
    }
    if (!info || (info.size || 0) === 0) {
      throw new Error("headless browser produced no screenshot" + (result.stderr ? ": " + String(result.stderr).slice(0, 300) : ""));
    }
    const bytes = await fs.readBytes(destTarget, undefined, IMAGE_CAP);
    const size = readPngSize(bytes);
    return {
      dest: destRel,
      path: slug + "/" + destRel,
      w: size ? size.width : null,
      h: size ? size.height : null,
      bytes: bytes.length,
    };
  } finally {
    try { await removePaths([profileAbs], await rootPath()); } catch (_) {}
  }
}

  return { capturePreviewToSystem };
}
