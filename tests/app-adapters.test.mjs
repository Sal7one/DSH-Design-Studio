import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { inspectProject, tagContextFor } from "../lib/host/app-adapters.js";

async function fixture(files) {
  const dir = await mkdtemp(join(tmpdir(), "app-adapters-"));
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, content, "utf8");
  }
  return dir;
}

test("Compose adapter extracts tagged components, routes and tokens", async () => {
  const dir = await fixture({
    "app/src/main/java/demo/Home.kt": `package demo

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

val Bg = Color(0xFF0A2F6B)

@Composable
fun Home() {
    Box(Modifier.testTag("HOME_CARD"))
}

fun openSettings() {
    navController.navigate("settings")
}
`,
    "app/src/main/java/demo/Nav.kt": `package demo

fun graph() {
    composable(route = "settings") { Home() }
}
`,
  });
  try {
    const graph = await inspectProject(dir);
    assert.equal(graph.adapter.id, "compose");
    assert.equal(graph.adapter.capabilities.source, true);
    assert.ok(graph.components.some((component) => component.tag === "HOME_CARD" && component.function === "Home"));
    assert.ok(graph.routes.some((route) => route.route === "settings"));
    assert.ok(graph.tokens.some((token) => token.name === "Bg" && token.value === "0xFF0A2F6B"));
    const details = tagContextFor(graph, "HOME_CARD");
    assert.equal(details.tag, "HOME_CARD");
    assert.equal(details.definitions[0].function, "Home");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runtime adapter is honest when no source is available", async () => {
  const dir = await fixture({ "README.md": "# app\n" });
  try {
    const graph = await inspectProject(dir);
    assert.equal(graph.adapter.id, "runtime");
    assert.equal(graph.adapter.capabilities.source, false);
    assert.equal(graph.adapter.capabilities.components, false);
    assert.deepEqual(graph.components, []);
    assert.deepEqual(graph.routes, []);
    assert.deepEqual(graph.tokens, []);
    assert.ok(graph.adapter.reason.length > 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("runtime adapter is the no-project fallback", async () => {
  const graph = await inspectProject("");
  assert.equal(graph.adapter.id, "runtime");
  assert.equal(graph.adapter.capabilities.source, false);
  assert.equal(graph.files, 0);
});
