// Pure helpers over normalized QaLens live data: screen outlines, act/observe diffs, screen
// audits, value tracing, stable selectors and generated UI tests. No I/O.

const MIN_TARGET_DP = 48;
// A typical phone is 360–430 dp wide; used only when the device density is unknown.
const REFERENCE_WIDTH_DP = 411;

export function clip(value, max = 120) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

/** The words a person sees on a node: its text, its edited value, then its content description. */
export function visibleText(node) {
  if (!node) return "";
  const text = (node.text || []).filter(Boolean).join(" ");
  if (text.trim()) return text;
  if (typeof node.value === "string" && node.value.trim()) return node.value;
  return (node.description || []).filter(Boolean).join(" ");
}

export function describeNode(node) {
  if (!node) return "unknown node";
  const words = visibleText(node) || (node.label === "[protected]" ? node.label : "");
  return (node.role || "Node") + (words ? ' "' + clip(words, 60) + '"' : "") + (node.tag ? " #" + node.tag : "");
}

function interesting(node) {
  return Boolean(node.tag || visibleText(node) || node.label === "[protected]" || (node.actions && node.actions.length) || node.role);
}

function childrenOf(nodes) {
  const ids = new Set(nodes.map(node => node.id));
  const children = new Map();
  for (const node of nodes) {
    const parent = node.parentId && ids.has(node.parentId) ? node.parentId : "";
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(node);
  }
  return children;
}

function formatBounds(b) {
  return "@" + b.left + "," + b.top + " " + Math.max(0, b.right - b.left) + "×" + Math.max(0, b.bottom - b.top);
}

function formatNode(node) {
  const extras = [];
  if (node.actions && node.actions.length) extras.push("[" + node.actions.join(",") + "]");
  if (node.enabled === false) extras.push("disabled");
  if (node.state) extras.push("state=" + clip(node.state, 40));
  return node.id + " " + describeNode(node) + (extras.length ? " " + extras.join(" ") : "") + " " + formatBounds(node.bounds);
}

/** A compact, indented outline of the visible screen for a model: one interesting node per line. */
export function outlineScreen(snapshot, { filter = "", limit = 150 } = {}) {
  const nodes = snapshot.nodes || [];
  const children = childrenOf(nodes);
  const needle = String(filter || "").toLowerCase().trim();
  const max = Math.max(1, Math.min(1000, Number(limit) || 150));
  const lines = [];
  const seen = new Set();
  let matched = 0;
  const walk = (parent, depth) => {
    for (const node of children.get(parent) || []) {
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      const hit = interesting(node) && (!needle || (describeNode(node) + " " + node.id).toLowerCase().includes(needle));
      if (hit) {
        matched++;
        if (lines.length < max) lines.push("  ".repeat(needle ? 0 : Math.min(depth, 12)) + formatNode(node));
      }
      walk(node.id, hit && !needle ? depth + 1 : depth);
    }
  };
  walk("", 0);
  const header = "Screen: " + (snapshot.screen || "unknown") + (snapshot.route ? " (route " + snapshot.route + ")" : "")
    + " · " + nodes.length + " nodes" + (snapshot.omittedNodes ? " (+" + snapshot.omittedNodes + " omitted by QaLens)" : "")
    + (snapshot.selectedId ? " · selected " + snapshot.selectedId : "");
  const footer = matched > lines.length ? ["… " + (matched - lines.length) + " more; narrow with filter or raise limit."] : [];
  if (!lines.length) return header + "\n" + (needle ? "No node matches \"" + clip(filter, 60) + "\"." : "No visible semantics nodes.");
  return [header, "Format: id Role \"text\" #tag [actions] @left,top width×height (px)", ...lines, ...footer].join("\n");
}

function contentKey(node) {
  return [node.role, node.tag, visibleText(node)].join("\u0000");
}

/** What an action changed: screen/route, nodes that appeared or disappeared, and edited values. */
export function diffScreens(before, after) {
  const beforeById = new Map((before.nodes || []).map(node => [node.id, node]));
  const changed = [];
  for (const node of after.nodes || []) {
    const old = beforeById.get(node.id);
    if (old && (old.value !== node.value || old.state !== node.state || old.enabled !== node.enabled || visibleText(old) !== visibleText(node))) {
      changed.push({ node, before: old });
    }
  }
  const changedIds = new Set(changed.map(item => item.node.id));
  const group = (nodes) => {
    const groups = new Map();
    for (const node of nodes) {
      if (!interesting(node) || changedIds.has(node.id)) continue;
      const key = contentKey(node);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(node);
    }
    return groups;
  };
  const a = group(before.nodes || []), b = group(after.nodes || []);
  const added = [], removed = [];
  for (const [key, list] of b) added.push(...list.slice((a.get(key) || []).length));
  for (const [key, list] of a) removed.push(...list.slice((b.get(key) || []).length));
  return {
    screenChanged: before.screen !== after.screen || before.route !== after.route,
    before: { screen: before.screen, route: before.route },
    after: { screen: after.screen, route: after.route },
    added, removed, changed,
  };
}

export function formatDiff(diff, { limit = 8 } = {}) {
  const lines = [];
  if (diff.screenChanged) {
    lines.push("screen: " + (diff.before.screen || "?") + " → " + (diff.after.screen || "?")
      + (diff.before.route !== diff.after.route ? " (route " + (diff.before.route || "?") + " → " + (diff.after.route || "?") + ")" : ""));
  } else lines.push("screen: unchanged (" + (diff.after.screen || diff.after.route || "unknown") + ")");
  const list = (label, nodes) => {
    if (!nodes.length) return;
    lines.push(label + ": " + nodes.slice(0, limit).map(describeNode).join(", ") + (nodes.length > limit ? ", … (+" + (nodes.length - limit) + ")" : ""));
  };
  list("appeared", diff.added);
  list("disappeared", diff.removed);
  for (const item of diff.changed.slice(0, limit)) {
    lines.push("changed: " + describeNode(item.before) + " → " + clip(visibleText(item.node) || item.node.state || (item.node.enabled ? "enabled" : "disabled"), 80));
  }
  if (!diff.screenChanged && !diff.added.length && !diff.removed.length && !diff.changed.length) lines.push("no visible change yet; the app may still be loading or the action had no effect");
  return lines;
}

function labeled(node, children, depth = 0) {
  if (visibleText(node)) return true;
  if (depth > 6) return false;
  return (children.get(node.id) || []).some(child => labeled(child, children, depth + 1));
}

/** Accessibility and testability findings for the visible screen. Sizes use dp at `density`. */
export function auditScreen(snapshot, { density = 0 } = {}) {
  const nodes = snapshot.nodes || [];
  const children = childrenOf(nodes);
  const width = (snapshot.screenViewport && snapshot.screenViewport.width) || (snapshot.viewport && snapshot.viewport.width) || 0;
  const measured = Number.isFinite(density) && density > 0;
  const scale = measured ? density : width ? Math.max(1, Math.round((width / REFERENCE_WIDTH_DP) * 4) / 4) : 0;
  const findings = [];
  const add = (rule, severity, node, detail, fix) => findings.push({ rule, severity, nodeId: node ? node.id : "", node: node ? describeNode(node) : "", detail, fix });
  const actionable = nodes.filter(node => node.enabled !== false && node.actions && node.actions.length);
  for (const node of actionable) {
    if (node.label === "[protected]") continue;
    if (!labeled(node, children)) {
      add(node.actions.includes("type") ? "unlabeled-field" : "unlabeled-action", "error", node,
        "Can " + node.actions.join("/") + " but has no text or content description; TalkBack announces nothing useful.",
        node.actions.includes("type") ? "Give the field a label (TextField label = { Text(\"…\") }) or Modifier.semantics { contentDescription = \"…\" }."
          : "Add visible text or Modifier.semantics { contentDescription = \"…\" }.");
    }
    const w = node.bounds.right - node.bounds.left, h = node.bounds.bottom - node.bounds.top;
    if (scale && w > 0 && h > 0 && node.actions.includes("tap")) {
      const wdp = w / scale, hdp = h / scale;
      if (wdp < MIN_TARGET_DP - 0.5 || hdp < MIN_TARGET_DP - 0.5) {
        add("small-target", "warning", node, Math.round(wdp) + "×" + Math.round(hdp) + " dp" + (measured ? "" : " (estimated density " + scale + ")") + "; the minimum touch target is 48×48 dp.",
          "Use Modifier.minimumInteractiveComponentSize() or size the touch area to at least 48.dp.");
      }
    }
  }
  const byTag = new Map();
  for (const node of nodes) if (node.tag) byTag.set(node.tag, (byTag.get(node.tag) || []).concat(node));
  for (const [tag, list] of byTag) {
    if (list.length > 1) add("duplicate-tag", "warning", list[0], list.length + " visible nodes share tag \"" + clip(tag, 80) + "\"; tests and QaLens tag commands cannot choose one.",
      "Give each instance a unique Modifier.testTag (for example include the item id).");
  }
  const untagged = actionable.filter(node => !node.tag);
  if (untagged.length) {
    add("untagged-actions", "info", untagged[0], untagged.length + " actionable node" + (untagged.length === 1 ? " has" : "s have") + " no test tag: "
      + untagged.slice(0, 5).map(describeNode).join(", ") + (untagged.length > 5 ? ", …" : "") + ".",
      "Add Modifier.testTag(\"…\") so UI tests and QaLens flows can target them reliably.");
  }
  for (const node of nodes) {
    if (node.role === "Image" && !(node.description || []).length && !(node.actions || []).length) {
      add("image-without-description", "info", node, "Image has no content description.", "Set contentDescription, or null when the image is decorative.");
    }
  }
  const order = { error: 0, warning: 1, info: 2 };
  findings.sort((x, y) => order[x.severity] - order[y.severity]);
  const counts = { error: 0, warning: 0, info: 0 };
  for (const finding of findings) counts[finding.severity]++;
  return { screen: snapshot.screen, route: snapshot.route, density: scale, densitySource: measured ? "device" : scale ? "estimated" : "unknown", counts, findings };
}

export function formatAudit(audit, { limit = 40 } = {}) {
  const head = "Audit of " + (audit.screen || audit.route || "the current screen") + ": " + audit.counts.error + " error, " + audit.counts.warning + " warning, " + audit.counts.info + " info"
    + (audit.densitySource === "estimated" ? " (touch sizes use an estimated density)" : "");
  if (!audit.findings.length) return head + "\nNo findings on the visible nodes. Hidden, off-screen and non-Compose UI are not covered.";
  return [head, ...audit.findings.slice(0, limit).map(f => "- [" + f.severity + "] " + f.rule + (f.nodeId ? " · " + f.nodeId + " " + f.node : "") + ": " + f.detail + " Fix: " + f.fix),
    ...(audit.findings.length > limit ? ["… " + (audit.findings.length - limit) + " more"] : [])].join("\n");
}

/** Search strings for a visible value: the text itself and, for numbers, their plain forms. */
export function traceNeedles(value) {
  const raw = clip(value, 200);
  const needles = [];
  if (raw.length >= 3) needles.push(raw);
  for (const number of raw.match(/-?\d[\d,]*(?:\.\d+)?/g) || []) {
    for (const form of [number, number.replace(/,/g, "")]) {
      if ((form.replace(/^-/, "").length >= 3 || form.includes(".")) && !needles.includes(form)) needles.push(form);
    }
  }
  return needles.slice(0, 6);
}

function excerpt(text, at, length) {
  const start = Math.max(0, at - 50), end = Math.min(text.length, at + length + 50);
  return (start ? "…" : "") + text.slice(start, end).replace(/\s+/g, " ") + (end < text.length ? "…" : "");
}

/** Where a visible value also appears: network previews and URLs, decoded app data, logs, events. */
export function traceValue(value, { events = null, data = null } = {}) {
  const needles = traceNeedles(value);
  const matches = [];
  const find = (text) => {
    if (typeof text !== "string" || !text) return null;
    const lower = text.toLowerCase();
    for (const needle of needles) {
      const at = lower.indexOf(needle.toLowerCase());
      if (at >= 0) return { needle, excerpt: excerpt(text, at, needle.length) };
    }
    return null;
  };
  if (needles.length) {
    for (const call of [...((events && events.network) || [])].reverse()) {
      for (const [where, text] of [["response", call.responsePreview], ["request", call.requestPreview], ["url", call.url]]) {
        const hit = find(text);
        if (hit) { matches.push({ source: "network", where, method: call.method, url: call.url, status: call.status, time: call.time, ...hit }); break; }
      }
    }
    for (const [name, values] of Object.entries((data && data.dataSources) || {})) {
      for (const [key, item] of Object.entries(values || {})) {
        const hit = find(String(item));
        if (hit) matches.push({ source: "data", name, key, ...hit });
      }
    }
    for (const log of [...((events && events.logs) || [])].reverse()) {
      const hit = find(log.message);
      if (hit) matches.push({ source: "log", tag: log.tag, time: log.time, ...hit });
    }
    for (const event of [...((events && events.events) || [])].reverse()) {
      if (event.type === "LOG") continue;
      const hit = find(event.message);
      if (hit) matches.push({ source: "event", type: event.type, tag: event.tag, time: event.time, ...hit });
    }
  }
  return {
    value: clip(value, 200), needles, matches: matches.slice(0, 12), omitted: Math.max(0, matches.length - 12),
    bodiesCaptured: ((events && events.network) || []).some(call => call.responsePreview),
  };
}

function clock(time) {
  return Number.isFinite(time) ? new Date(time).toISOString().slice(11, 19) : "--:--:--";
}

export function formatTrace(trace) {
  if (!trace.needles.length) return "Nothing to trace: the value is too short.";
  const head = "Where \"" + clip(trace.value, 80) + "\" appears (" + trace.matches.length + (trace.omitted ? "+" + trace.omitted : "") + " matches):";
  const lines = trace.matches.map(m => m.source === "network"
    ? "- network " + m.where + ": " + (m.method || "") + " " + clip(m.url, 120) + " → " + (m.status ?? "no status") + " at " + clock(m.time) + " · " + m.excerpt
    : m.source === "data" ? "- app data " + clip(m.name, 60) + " › " + clip(m.key, 60) + " · " + m.excerpt
      : "- " + m.source + " " + clock(m.time) + " " + clip(m.tag || m.type || "", 40) + " · " + m.excerpt);
  const notes = trace.bodiesCaptured ? [] : ["Note: no response bodies were captured. Bodies appear only when the host app enables QaLens network body capture."];
  return [head, ...(lines.length ? lines : ["- no match in recent network, app data, logs or events"]), ...notes].join("\n");
}

const ERROR_WORDS = /\b(error|exception|failed|failure|fatal|crash|timeout|timed out|unauthori[sz]ed|forbidden|denied|refused|unable)\b/i;
export function recentProblems(events, { limit = 5 } = {}) {
  const failedRequests = ((events && events.network) || []).filter(call => call.error || (Number.isFinite(call.status) && call.status >= 400));
  const errorLogs = ((events && events.logs) || []).filter(log => ERROR_WORDS.test(String(log.message || "")) || /^E\b|error/i.test(String(log.tag || "")));
  return {
    counts: { failedRequests: failedRequests.length, errorLogs: errorLogs.length },
    failedRequests: failedRequests.slice(-limit).reverse(),
    errorLogs: errorLogs.slice(-limit).reverse(),
  };
}

export function xpathLiteral(value) {
  const text = String(value);
  if (!text.includes("'")) return "'" + text + "'";
  if (!text.includes('"')) return '"' + text + '"';
  return "concat(" + text.split("'").map(part => "'" + part + "'").join(",\"'\",") + ")";
}

const LITERAL = String.raw`(?:'([^']*)'|"([^"]*)")`;
const SIMPLE = new RegExp(String.raw`^//node\[@(tag|text|description|label)=` + LITERAL + String.raw`\]$`);
const ROLE = new RegExp(String.raw`^//node\[@role=` + LITERAL + String.raw` and @(text|description|label)=` + LITERAL + String.raw`\]$`);
const WITHIN = new RegExp(String.raw`^//node\[@tag=` + LITERAL + String.raw`\]//node\[@tag=` + LITERAL + String.raw`\]$`);

/** Turn a QaLens XPath suggestion into a finder kind when it has one of the generated forms. */
export function parseXpath(xpath) {
  let m = SIMPLE.exec(xpath);
  if (m) return { kind: m[1], value: m[2] ?? m[3] };
  m = ROLE.exec(xpath);
  if (m) return { kind: m[3], value: m[4] ?? m[5], role: m[1] ?? m[2] };
  m = WITHIN.exec(xpath);
  if (m) return { kind: "tag", value: m[3] ?? m[4], within: m[1] ?? m[2] };
  return null;
}

/** The most durable unique selector for a node: tag, then content, then (fragile) tree position. */
export function stableSelector(node, suggestions = []) {
  const unique = (suggestions || []).filter(item => item && item.matches === 1 && typeof item.xpath === "string");
  const pick = unique.find(item => item.stability === "tag") || unique.find(item => item.stability === "content");
  if (pick) return { ...(parseXpath(pick.xpath) || { kind: "xpath", value: pick.xpath }), xpath: pick.xpath, stability: pick.stability };
  if (node && node.tag) return { kind: "tag", value: node.tag, xpath: "//node[@tag=" + xpathLiteral(node.tag) + "]", stability: "tag", unverified: true };
  const words = node && (node.text || []).find(Boolean);
  if (words) return { kind: "text", value: words, xpath: "//node[@text=" + xpathLiteral(words) + "]", stability: "content", unverified: true };
  const position = unique.find(item => item.stability === "position");
  return position ? { kind: "xpath", value: position.xpath, xpath: position.xpath, stability: "position" } : null;
}

/** The command target a recorded selector replays with. */
export function commandTarget(selector) {
  if (!selector) return null;
  if (selector.kind === "tag" && !selector.within) return { tag: selector.value };
  return { xpath: selector.xpath };
}

function kotlinString(value) {
  return '"' + String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$")
    .replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t") + '"';
}

function composeFinder(selector) {
  if (!selector) return { note: "no selector was recorded" };
  const value = kotlinString(selector.value);
  switch (selector.kind) {
    case "tag":
      return { code: selector.within ? "composeRule.onNode(hasTestTag(" + value + ") and hasAnyAncestor(hasTestTag(" + kotlinString(selector.within) + ")))" : "composeRule.onNodeWithTag(" + value + ")" };
    case "text": return { code: "composeRule.onNodeWithText(" + value + ")" };
    case "description": return { code: "composeRule.onNodeWithContentDescription(" + value + ")" };
    case "label": return { code: "composeRule.onNode(hasText(" + value + ") or hasContentDescription(" + value + "))" };
    default: return { note: "QaLens XPath " + selector.xpath + " has no Compose finder" };
  }
}

function swipe(step) {
  const dx = Number(step.dx) || 0, dy = Number(step.dy) || 0;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "swipeLeft()" : "swipeRight()";
  return dy < 0 ? "swipeDown()" : "swipeUp()";
}

function className(name) {
  const words = String(name || "").replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const joined = words.map(word => word[0].toUpperCase() + word.slice(1)).join("");
  if (!joined) return "RecordedFlowTest";
  const safe = /^[0-9]/.test(joined) ? "Flow" + joined : joined;
  return safe.endsWith("Test") ? safe : safe + "Test";
}

function packageName(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/.test(String(value || "")) ? value : "com.example.app";
}

function stepComment(index, step) {
  return "// " + (index + 1) + ". " + step.op + " " + clip(step.node || "", 80) + (step.screen || step.route ? " on " + clip(step.screen || step.route, 60) : "");
}

/** A Compose UI test (JUnit4) that replays a recorded flow and checks what each step revealed. */
export function composeTest(flow, { testName = "" } = {}) {
  const steps = (flow && flow.steps) || [];
  const activity = flow && typeof flow.activity === "string" && /^[A-Za-z_][\w.$]*$/.test(flow.activity) ? flow.activity : "";
  const simple = activity ? activity.split(".").pop().split("$").pop() : "MainActivity";
  const body = [];
  steps.forEach((step, index) => {
    const finder = composeFinder(step.selector);
    body.push("        " + stepComment(index, step));
    if (!finder.code) { body.push("        // TODO: " + finder.note + ". Add Modifier.testTag to this element and record the step again."); return; }
    if (step.op === "tap") body.push("        " + finder.code + ".performClick()");
    else if (step.op === "type") body.push("        " + finder.code + ".performTextReplacement(" + (step.secret ? 'TODO("the password is not recorded")' : kotlinString(step.text || "")) + ")");
    else if (step.op === "scroll") body.push("        " + finder.code + ".performTouchInput { " + swipe(step) + " }");
    body.push("        composeRule.waitForIdle()");
    const expected = step.expect ? composeFinder(step.expect) : null;
    if (expected && expected.code) body.push("        " + expected.code + ".assertExists()");
  });
  if (!steps.length) body.push("        // No steps recorded yet. Drive the app with design_studio action=qalens_act, then generate again.");
  return [
    "package " + packageName(flow && flow.package),
    "",
    "import androidx.compose.ui.test.*",
    "import androidx.compose.ui.test.junit4.createAndroidComposeRule",
    "import androidx.test.ext.junit.runners.AndroidJUnit4",
    ...(activity ? ["import " + activity.replace(/\$/g, ".")] : []),
    "import org.junit.Rule",
    "import org.junit.Test",
    "import org.junit.runner.RunWith",
    "",
    "/**",
    " * Generated by Design Studio from a QaLens flow (" + steps.length + " step" + (steps.length === 1 ? "" : "s") + ").",
    " * Needs androidTestImplementation(\"androidx.compose.ui:ui-test-junit4\") and",
    " * debugImplementation(\"androidx.compose.ui:ui-test-manifest\").",
    ...(activity ? [] : [" * TODO: replace MainActivity with the activity that hosts this flow."]),
    " */",
    "@RunWith(AndroidJUnit4::class)",
    "class " + className(flow && flow.name) + " {",
    "    @get:Rule",
    "    val composeRule = createAndroidComposeRule<" + simple + ">()",
    "",
    "    @Test",
    "    fun replaysRecordedFlow() {",
    ...body,
    "    }",
    "}",
    "",
  ].join("\n");
}

function maestroSelector(selector) {
  if (!selector) return null;
  if (selector.kind === "tag" && !selector.within) return ["    id: " + JSON.stringify(selector.value)];
  if (selector.kind === "text" || selector.kind === "description" || selector.kind === "label") return ["    text: " + JSON.stringify(selector.value)];
  return null;
}

/** A Maestro flow for the same steps. Tags need testTagsAsResourceId = true in the app. */
export function maestroFlow(flow) {
  const steps = (flow && flow.steps) || [];
  const lines = [
    "# Generated by Design Studio from a QaLens flow (" + steps.length + " steps).",
    "# Test tags match `id` only when the app sets testTagsAsResourceId = true.",
    "appId: " + JSON.stringify(packageName(flow && flow.package)),
    "---",
    "- launchApp",
  ];
  steps.forEach((step, index) => {
    lines.push("# " + (index + 1) + ". " + step.op + " " + clip(step.node || "", 80));
    const selector = maestroSelector(step.selector);
    if (!selector) { lines.push("# TODO: no Maestro selector for this element; add a test tag and record again."); return; }
    if (step.op === "tap") lines.push("- tapOn:", ...selector);
    else if (step.op === "type") {
      lines.push("- tapOn:", ...selector, "- eraseText");
      lines.push(step.secret ? "# TODO: the password is not recorded" : "- inputText: " + JSON.stringify(step.text || ""));
    } else if (step.op === "scroll") {
      const dir = swipe(step).replace("swipe", "").replace("()", "").toUpperCase();
      lines.push("- swipe:", "    direction: " + dir);
    }
    const expected = step.expect ? maestroSelector(step.expect) : null;
    if (expected) lines.push("- assertVisible:", ...expected);
  });
  return lines.join("\n") + "\n";
}

/** A node that appeared after a step and can be found again: unique tag first, then unique text. */
export function expectationFor(diff, after) {
  const nodes = (after && after.nodes) || [];
  const count = (predicate) => nodes.filter(predicate).length;
  for (const node of diff.added) {
    if (node.tag && count(other => other.tag === node.tag) === 1) return { kind: "tag", value: node.tag, xpath: "//node[@tag=" + xpathLiteral(node.tag) + "]" };
  }
  for (const node of diff.added) {
    const words = (node.text || []).find(Boolean);
    if (words && words.length <= 80 && count(other => (other.text || []).includes(words)) === 1) {
      return { kind: "text", value: words, xpath: "//node[@text=" + xpathLiteral(words) + "]" };
    }
  }
  return null;
}
