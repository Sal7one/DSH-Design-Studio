import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { resolveSourceClaim } from "../lib/host/source-map.js";

const hash = (value) => createHash("sha256").update(value).digest("hex");
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "ds-source-map-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function put(root, path, value) {
  const file = join(root, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, value);
}
const mapPath = (module = "app") => `${module}/build/generated/qalens-source-map/debug/qalens/source-map.json`;
const entry = (source, overrides = {}) => ({ id: hash("ref"), path: "src/main/Home.kt", line: 2, sourceSha256: hash(source), alias: "CARD", kind: "wrapper", symbol: "demo.Card", ...overrides });
const map = (entries) => JSON.stringify({ schema: "qalens.source-map", version: 1, module: ":app", matching: "node-reference-or-candidate", omittedLocations: 0, entries });

test("source reference and current hash resolve relative to the module", async (t) => {
  const root = await fixture(t), source = "@Composable\nfun Home() = Card()\n";
  await put(root, "app/src/main/Home.kt", source);
  await put(root, mapPath(), map([entry(source)]));
  const claim = await resolveSourceClaim({ projectRoot: root, sourceRef: hash("ref"), tag: "HOME_CARD" });
  assert.equal(claim.state, "verified");
  assert.equal(claim.candidates[0].file, "app/src/main/Home.kt");
  assert.equal(claim.candidates[0].line, 2);
  assert.match(claim.candidates[0].snippet, /fun Home/);
});

test("alias alone is a candidate; duplicated aliases are ambiguous", async (t) => {
  const root = await fixture(t), source = "one\ntwo\n";
  await put(root, "app/src/main/Home.kt", source);
  await put(root, mapPath(), map([entry(source)]));
  assert.equal((await resolveSourceClaim({ projectRoot: root, tag: "HOME_CARD" })).state, "candidate");
  await put(root, mapPath(), map([entry(source), entry(source, { id: hash("second"), line: 1 })]));
  assert.equal((await resolveSourceClaim({ projectRoot: root, tag: "HOME_CARD" })).state, "ambiguous");
  assert.equal((await resolveSourceClaim({ projectRoot: root, sourceRef: hash("second"), tag: "HOME_CARD" })).state, "verified");
});

test("changed source is stale; an absent or duplicated source reference cannot verify", async (t) => {
  const root = await fixture(t), source = "one\ntwo\n";
  await put(root, "app/src/main/Home.kt", source + "changed");
  await put(root, mapPath(), map([entry(source)]));
  let claim = await resolveSourceClaim({ projectRoot: root, sourceRef: hash("ref") });
  assert.equal(claim.state, "stale");
  assert.equal(claim.candidates[0].snippet, undefined);
  assert.equal((await resolveSourceClaim({ projectRoot: root, sourceRef: hash("missing"), tag: "CARD" })).state, "unavailable");
  await put(root, mapPath(), map([entry(source), entry(source, { line: 1 })]));
  claim = await resolveSourceClaim({ projectRoot: root, sourceRef: hash("ref") });
  assert.equal(claim.state, "ambiguous");
});

test("manual tags are candidates and never verified", async (t) => {
  const root = await fixture(t);
  await put(root, "app/src/main/Home.kt", '@Composable\nfun Home() { Box(Modifier.testTag("MANUAL")) }\n');
  const claim = await resolveSourceClaim({ projectRoot: root, tag: "MANUAL" });
  assert.equal(claim.state, "candidate");
  assert.equal(claim.candidates[0].file, "app/src/main/Home.kt");
  assert.equal(claim.candidates[0].origin, "manual-tag");
});

test("unknown schema, traversal and symlinked source fail closed", async (t) => {
  const root = await fixture(t), source = "one\ntwo\n";
  await put(root, "outside.kt", source);
  await put(root, "app/src/main/Home.kt", source);
  await put(root, mapPath(), JSON.stringify({ schema: "other", version: 1, entries: [] }));
  assert.equal((await resolveSourceClaim({ projectRoot: root, sourceRef: hash("ref") })).state, "unavailable");
  await put(root, mapPath(), map([entry(source, { path: "../outside.kt" })]));
  assert.equal((await resolveSourceClaim({ projectRoot: root, sourceRef: hash("ref") })).state, "unavailable");
  await symlink(join(root, "outside.kt"), join(root, "app/src/main/Linked.kt"));
  await put(root, mapPath(), map([entry(source, { path: "src/main/Linked.kt" })]));
  assert.equal((await resolveSourceClaim({ projectRoot: root, sourceRef: hash("ref") })).state, "unavailable");
});
