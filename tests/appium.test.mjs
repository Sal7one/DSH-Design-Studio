import test from "node:test";
import assert from "node:assert/strict";

import { expandCommandArgv, gradleInvocation, normalizeCommandArgv, parseUiTree, routeTagCandidates, locatorFor } from "../lib/host/appium.js";

const UIAUTOMATOR_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <node index="0" class="android.widget.FrameLayout" package="com.example.app" bounds="[0,0][1080,2400]" clickable="false" enabled="true">
    <node index="0" class="android.widget.TextView" text="Design &amp; Live" resource-id="HOME_TITLE" bounds="[89,173][651,296]" clickable="true" enabled="true"/>
  </node>
</hierarchy>`;

const APPIUM3_XML = `<hierarchy>
  <android.widget.FrameLayout package="com.example.app" bounds="[0,0][1080,2400]">
    <android.widget.TextView text="Hello" content-desc="Greeting" bounds="[10,20][200,80]"/>
  </android.widget.FrameLayout>
</hierarchy>`;

test("parses uiautomator2 <node> page sources", () => {
  const nodes = parseUiTree(UIAUTOMATOR_XML);
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].className, "android.widget.FrameLayout");
  assert.equal(nodes[0].depth, 1);
  assert.equal(nodes[1].resourceId, "HOME_TITLE");
  assert.equal(nodes[1].text, "Design & Live");
  assert.deepEqual(nodes[1].bounds, { x: 89, y: 173, w: 562, h: 123 });
  assert.equal(nodes[1].clickable, true);
  assert.equal(nodes[1].depth, 2);
});

test("parses Appium 3 class-tag page sources", () => {
  const nodes = parseUiTree(APPIUM3_XML);
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0].className, "android.widget.FrameLayout");
  assert.equal(nodes[1].className, "android.widget.TextView");
  assert.equal(nodes[1].text, "Hello");
  assert.equal(nodes[1].contentDesc, "Greeting");
});

test("resource-id becomes an XPath locator", () => {
  const locator = locatorFor({ resourceId: "HOME_TITLE", contentDesc: "", text: "", className: "android.widget.TextView" });
  assert.deepEqual(locator, { using: "xpath", value: '//*[@resource-id="HOME_TITLE"]' });
  const quoted = locatorFor({ resourceId: 'a"b', contentDesc: "", text: "", className: "android.view.View" });
  assert.deepEqual(quoted, { using: "xpath", value: '//*[@resource-id=\'a"b\']' });
});

test("content-desc becomes an accessibility id", () => {
  const locator = locatorFor({ resourceId: "", contentDesc: "Open profile", text: "", className: "android.view.View" });
  assert.deepEqual(locator, { using: "accessibility id", value: "Open profile" });
});

test("text falls back to XPath and quotes both quote kinds", () => {
  const plain = locatorFor({ resourceId: "", contentDesc: "", text: "Open profile", className: "android.widget.TextView" });
  assert.deepEqual(plain, { using: "xpath", value: '//*[@text="Open profile"]' });

  const doubleQuoted = locatorFor({ resourceId: "", contentDesc: "", text: 'Say "hi"', className: "android.widget.TextView" });
  assert.deepEqual(doubleQuoted, { using: "xpath", value: "//*[@text='Say \"hi\"']" });

  const both = locatorFor({ resourceId: "", contentDesc: "", text: 'He said "it\'s fine"', className: "android.widget.TextView" });
  assert.deepEqual(both, { using: "xpath", value: '//*[@text=concat("He said ", \'"\', "it\'s fine", \'"\')]' });
});

test("class name is the last-resort locator", () => {
  const locator = locatorFor({ resourceId: "", contentDesc: "", text: "", className: "android.widget.EditText" });
  assert.deepEqual(locator, { using: "class name", value: "android.widget.EditText" });
});

test("gradle invocation requires an absolute root and a safe task", () => {
  const inv = gradleInvocation("/tmp/chirpy", ":app:assembleDebug");
  assert.equal(inv.cwd, "/tmp/chirpy");
  assert.equal(inv.task, ":app:assembleDebug");
  assert.ok(inv.argv[0].endsWith("gradlew"));
  assert.ok(inv.argv.includes(":app:assembleDebug"));
  assert.throws(() => gradleInvocation("relative/project", ":app:assembleDebug"), /absolute path/);
  assert.throws(() => gradleInvocation("/tmp/app", ":app:assembleDebug; rm -rf /"), /invalid Gradle build task/);
  assert.throws(() => gradleInvocation("/tmp/app", ":app:assembleDebug\ntouch pwned"), /invalid Gradle build task/);
});

test("route tags cover NAV/ROUTE/SCREEN and strip path params", () => {
  const settings = routeTagCandidates("settings");
  assert.ok(settings.includes("NAV_SETTINGS"));
  assert.ok(settings.includes("ROUTE_SETTINGS"));
  assert.ok(settings.includes("SCREEN_SETTINGS"));
  const details = routeTagCandidates("place_details/{placeID}");
  assert.ok(details.includes("NAV_PLACE_DETAILS"));
  assert.ok(!details.some((tag) => tag.includes("{")));
});

test("generic commands are argv-only and expand placeholders", () => {
  const argv = normalizeCommandArgv(["make", "{projectRoot}/build", "--apk={apk}"], "buildCommand");
  assert.deepEqual(expandCommandArgv(argv, "/tmp/app", "/tmp/app/a.apk"), ["make", "/tmp/app/build", "--apk=/tmp/app/a.apk"]);
  assert.throws(() => normalizeCommandArgv(["make\nrm -rf /"], "buildCommand"), /invalid buildCommand/);
  assert.throws(() => normalizeCommandArgv(["make", ""], "buildCommand"), /invalid buildCommand/);
  assert.deepEqual(normalizeCommandArgv([], "buildCommand"), []);
});
