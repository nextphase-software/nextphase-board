// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const source = new URL("../apps/web/src/", import.meta.url);
const ui = new URL("ui/", source);
function files(directory, prefix = "") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = prefix + entry.name;
    return entry.isDirectory()
      ? files(new URL(entry.name + "/", directory), name + "/")
      : [name];
  });
}
const screenParts = files(ui).sort();
const contents = screenParts.map((name) => [name, readFileSync(new URL(name, ui), "utf8")]);

test("screen parts contain exactly the twelve modules named by 0001-W15 v1", () => {
  assert.deepEqual(screenParts, [
    "arrange-controls.tsx",
    "board-panel.tsx",
    "context-bar.tsx",
    "file-bar.tsx",
    "information-button.tsx",
    "information-panel.tsx",
    "navigation-panel.tsx",
    "notice.tsx",
    "objects-panel.tsx",
    "palette.tsx",
    "save-area.tsx",
    "zoom-controls.tsx",
  ]);
});

test("App.tsx stays within its extracted composition line budget", () => {
  const app = readFileSync(new URL("App.tsx", source), "utf8");
  const lines = (app.match(/\n/g) ?? []).length;
  assert(lines <= 1379, `App.tsx has ${lines} newlines; budget is 1379`);
});

test("screen parts hold no React state or context and import React only for types", () => {
  for (const [name, content] of contents) {
    assert.doesNotMatch(content, /\buse[A-Z]\w*\s*\(/, name);
    assert.doesNotMatch(content, /\bcreateContext\b/, name);
    const reactImports = content.matchAll(/\bimport\s+(?:(type)\s+)?(?:[^;]*?\s+from\s*)?["']react["']/g);
    for (const declaration of reactImports) {
      assert.equal(declaration[1], "type", `${name}: React imports must use import type`);
    }
  }
});

test("screen parts never import or re-export App", () => {
  for (const [name, content] of contents) {
    const declarations = content.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?["']([^"']+)["']/g);
    for (const declaration of declarations) {
      const module = declaration[1].replace(/\.(?:ts|tsx|js|jsx)$/, "");
      assert.doesNotMatch(module, /(?:^|\/)App$/, `${name}: dependency points to App`);
    }
  }
});

test("every screen part begins with the Apache-2.0 licence header", () => {
  for (const [name, content] of contents) {
    assert.equal(content.split("\n")[0], "// SPDX-License-Identifier: Apache-2.0", name);
  }
});
