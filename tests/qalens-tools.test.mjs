import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { auditScreen, composeTest, diffScreens, expectationFor, formatDiff, maestroFlow, outlineScreen, parseXpath, recentProblems,
  stableSelector, traceValue, xpathLiteral } from "../lib/host/qalens-tools.js";
import { clearSourceSearchCache, searchSource } from "../lib/host/source-search.js";
import { formatDeveloperTask } from "../lib/client/src/android-change-draft.js";

const node = (id, extra = {}) => ({ id, parentId: null, tag: "", label: "", text: [], description: [], role: "", value: null, state: null, enabled: true,
  bounds: { left: 0, top: 0, right: 200, bottom: 200 }, actions: [], ...extra });
const screen = (nodes, extra = {}) => ({ screen: "Home", route: "home", nodes, viewport: { width: 1080, height: 2400 }, screenViewport: { width: 1080, height: 2400 }, ...extra });

test("the outline nests interesting nodes, skips empty containers and filters flat", () => {
  const snap = screen([node("root"), node("btn", { parentId: "root", role: "Button", tag: "pay", actions: ["tap"] }), node("label", { parentId: "btn", text: ["Pay now"] })]);
  const outline = outlineScreen(snap);
  assert.match(outline, /^Screen: Home \(route home\)/);
  assert.match(outline, /\nbtn Button #pay \[tap\] @0,0 200×200\n  label Node "Pay now"/);
  assert.doesNotMatch(outline, /\nroot /);
  assert.equal(outlineScreen(snap, { filter: "pay now" }).split("\n").at(-1), 'label Node "Pay now" @0,0 200×200');
});

test("an act diff reports navigation, appeared and edited content, and picks a findable expectation", () => {
  const before = screen([node("a", { tag: "email", value: "", actions: ["type"] }), node("b", { text: ["Sign in"], actions: ["tap"] })]);
  const after = screen([node("a", { tag: "email", value: "x@y.z", actions: ["type"] }), node("c", { text: ["Welcome back"] }), node("d", { tag: "logout" })], { screen: "Dashboard", route: "dash" });
  const diff = diffScreens(before, after);
  assert.equal(diff.screenChanged, true);
  assert.deepEqual(diff.added.map(n => n.id), ["c", "d"]);
  assert.deepEqual(diff.removed.map(n => n.id), ["b"]);
  assert.deepEqual(diff.changed.map(c => c.node.id), ["a"]);
  assert.match(formatDiff(diff).join("\n"), /screen: Home → Dashboard[\s\S]*changed: Node "" #email|changed: Node #email → x@y.z/);
  assert.deepEqual(expectationFor(diff, after), { kind: "tag", value: "logout", xpath: "//node[@tag='logout']" });
});

test("the audit flags unlabeled actions, small targets, duplicate tags and untagged actions", () => {
  const snap = screen([
    node("icon", { role: "Button", actions: ["tap"], bounds: { left: 0, top: 0, right: 70, bottom: 70 } }),
    node("ok", { role: "Button", actions: ["tap"], tag: "row" }), node("okText", { parentId: "ok", text: ["OK"] }),
    node("dup", { tag: "row" }),
  ]);
  const audit = auditScreen(snap, { density: 2.625 });
  const rules = audit.findings.map(f => f.rule + ":" + f.nodeId);
  assert.ok(rules.includes("unlabeled-action:icon"));
  assert.ok(rules.includes("small-target:icon"));
  assert.ok(!rules.includes("unlabeled-action:ok"), "a labeled child counts as the action's label");
  assert.ok(rules.includes("duplicate-tag:ok"));
  assert.ok(rules.some(rule => rule.startsWith("untagged-actions")));
  assert.equal(audit.densitySource, "device");
  assert.equal(auditScreen(snap).densitySource, "estimated");
});

test("a visible value is traced to response bodies, app data and logs, newest first", () => {
  const events = {
    network: [{ method: "GET", url: "https://api/x/accounts", status: 200, time: 1, responsePreview: '{"balance":"24580.00"}' },
      { method: "GET", url: "https://api/x/old", status: 500, time: 2, error: "timeout" }],
    logs: [{ tag: "Repo", message: "loaded balance 24,580.00", time: 3 }], events: [],
  };
  const trace = traceValue("24,580.00 SAR", { events, data: { dataSources: { prefs: { lastBalance: "24580.00" } } } });
  assert.deepEqual(trace.matches.map(m => m.source), ["network", "data", "log"]);
  assert.equal(trace.matches[0].where, "response");
  assert.equal(recentProblems(events).counts.failedRequests, 1);
  assert.deepEqual(traceValue("OK", { events }).needles, []);
});

test("stable selectors prefer unique tags, then content, and become Compose and Maestro steps", () => {
  assert.equal(xpathLiteral("it's"), "\"it's\"");
  assert.deepEqual(parseXpath("//node[@role='Button' and @text='Pay']"), { kind: "text", value: "Pay", role: "Button" });
  assert.deepEqual(parseXpath("//node[@tag='list']//node[@tag='row']"), { kind: "tag", value: "row", within: "list" });
  const suggestions = [{ xpath: "//node[@text='Pay']", matches: 1, stability: "content" }, { xpath: "//node[@tag='pay']", matches: 1, stability: "tag" }];
  assert.equal(stableSelector(node("n"), suggestions).kind, "tag");
  assert.equal(stableSelector(node("n"), suggestions.slice(0, 1)).kind, "text");
  const flow = { package: "com.example.bank", activity: "com.example.bank.MainActivity", name: "pay flow", steps: [
    { op: "type", selector: { kind: "tag", value: "amount", xpath: "x" }, text: "10 $", node: "TextField #amount", screen: "Pay" },
    { op: "type", selector: { kind: "tag", value: "pin", xpath: "x" }, secret: true, text: "", node: "TextField #pin" },
    { op: "tap", selector: { kind: "text", value: "Pay", xpath: "x" }, node: 'Button "Pay"', expect: { kind: "tag", value: "receipt", xpath: "y" } },
  ] };
  const kotlin = composeTest(flow);
  assert.match(kotlin, /^package com\.example\.bank\n/);
  assert.match(kotlin, /import com\.example\.bank\.MainActivity\n/);
  assert.match(kotlin, /class PayFlowTest \{/);
  assert.match(kotlin, /composeRule\.onNodeWithTag\("amount"\)\.performTextReplacement\("10 \\\$"\)/);
  assert.match(kotlin, /performTextReplacement\(TODO\("the password is not recorded"\)\)/);
  assert.match(kotlin, /composeRule\.onNodeWithText\("Pay"\)\.performClick\(\)\n {8}composeRule\.waitForIdle\(\)\n {8}composeRule\.onNodeWithTag\("receipt"\)\.assertExists\(\)/);
  const yaml = maestroFlow(flow);
  assert.match(yaml, /appId: "com\.example\.bank"\n---\n- launchApp/);
  assert.match(yaml, /- tapOn:\n {4}id: "amount"\n- eraseText\n- inputText: "10 \$"/);
  assert.match(yaml, /- assertVisible:\n {4}id: "receipt"/);
});

test("developer tasks name the design, app and selection and keep captured data as context", () => {
  const text = formatDeveloperTask("fix", { slug: "bank", target: { package: "com.example.bank", projectRoot: "/src/bank" }, selection: { id: "n1", tag: "pay" }, intent: "Make Pay green" });
  assert.match(text, /slug "bank"/);
  assert.match(text, /"projectRoot": "\/src\/bank"/);
  assert.match(text, /implement this change in the app source: "Make Pay green"/);
  assert.match(text, /qalens_replay/);
  assert.equal(formatDeveloperTask("unknown", {}), "");
});

async function project(t, files) {
  const root = await mkdtemp(join(tmpdir(), "ds-source-search-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [path, value] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), value);
  }
  clearSourceSearchCache();
  return root;
}

test("source search finds tags, constants, templates and string resources, never test sources", async (t) => {
  const root = await project(t, {
    "app/src/main/java/demo/Tags.kt": 'object Tags { const val PAY = "pay.button" }\n',
    "app/src/main/java/demo/Home.kt": [
      "@Composable", "fun Home(name: String, total: String) {",
      '  Button(Modifier.testTag(Tags.PAY)) { Text("Pay now") }',
      '  Text("Hello, $name!", Modifier.qaTag("nav.tab.${route}"))',
      "  Text(stringResource(R.string.total_label, total))", "}", "",
    ].join("\n"),
    "app/src/main/res/values/strings.xml": '<resources><string name="total_label">Total: %1$s SAR</string></resources>\n',
    "app/src/test/java/demo/HomeTest.kt": 'val x = "Pay now"\n',
  });
  const byTag = await searchSource(root, { tag: "pay.button" });
  assert.deepEqual(byTag.candidates.map(c => [c.file, c.line, c.origin, c.symbol]), [["app/src/main/java/demo/Home.kt", 3, "tag-constant", "Home"]]);
  assert.equal((await searchSource(root, { tag: "nav.tab.cards" })).candidates[0].origin, "test-tag");
  assert.deepEqual((await searchSource(root, { texts: ["Pay now"] })).candidates.map(c => c.file), ["app/src/main/java/demo/Home.kt"]);
  assert.equal((await searchSource(root, { texts: ["Hello, Abdullah!"] })).candidates[0].line, 4);
  const resource = (await searchSource(root, { texts: ["Total: 24,580.00 SAR"] })).candidates[0];
  assert.deepEqual([resource.origin, resource.line, resource.resource.name], ["string-resource", 5, "total_label"]);
  assert.deepEqual((await searchSource(root, { texts: ["Nothing like this"] })).candidates, []);
});
