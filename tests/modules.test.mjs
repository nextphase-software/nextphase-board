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
const scene = new URL("scene/", source);
const sceneParts = files(scene).sort();
const sceneContents = sceneParts.map((name) => [name, readFileSync(new URL(name, scene), "utf8")]);
const objects = new URL("objects/", source);
const objectTypes = files(objects).sort();
const objectContents = objectTypes.map((name) => [name, readFileSync(new URL(name, objects), "utf8")]);

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
  assert(lines <= 349, `App.tsx has ${lines} newlines; budget is 349`);
});

test("screen parts hold no React state or context and import React only for types", () => {
  for (const [name, content] of [...contents, ...sceneContents]) {
    assert.doesNotMatch(content, /\buse[A-Z]\w*\s*\(/, name);
    assert.doesNotMatch(content, /\bcreateContext\b/, name);
    const reactImports = content.matchAll(/\bimport\s+(?:(type)\s+)?(?:[^;]*?\s+from\s*)?["']react["']/g);
    for (const declaration of reactImports) {
      assert.equal(declaration[1], "type", `${name}: React imports must use import type`);
    }
  }
});

test("screen parts never import or re-export App", () => {
  for (const [name, content] of [...contents, ...sceneContents, ...objectContents]) {
    const declarations = content.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?["']([^"']+)["']/g);
    for (const declaration of declarations) {
      const module = declaration[1].replace(/\.(?:ts|tsx|js|jsx)$/, "");
      assert.doesNotMatch(module, /(?:^|\/)App$/, `${name}: dependency points to App`);
    }
  }
});

test("every screen part begins with the Apache-2.0 licence header", () => {
  for (const [name, content] of [...contents, ...sceneContents, ...objectContents]) {
    assert.equal(content.split("\n")[0], "// SPDX-License-Identifier: Apache-2.0", name);
  }
});

test("scene parts contain exactly the four modules named by 0001-W16 v1", () => {
  assert.deepEqual(sceneParts, [
    "board-drawing.tsx",
    "inline-editor.tsx",
    "note-body.tsx",
    "overlays.tsx",
  ]);
});

test("object types contain exactly the three modules named by 0001-W16 v1", () => {
  assert.deepEqual(objectTypes, ["registry.ts", "sticky.ts", "text.ts"]);
});

test("object types never import React or Konva", () => {
  for (const [name, content] of objectContents) {
    assert.doesNotMatch(content, /\bimport\s+(?:[^;]*?\s+from\s*)?["'](?:react|react-konva|konva)["']/, name);
  }
});

test("composition and screen parts ask the registry instead of comparing type names", () => {
  const app = readFileSync(new URL("App.tsx", source), "utf8");
  for (const [name, content] of [["App.tsx", app], ...contents, ...sceneContents]) {
    assert.doesNotMatch(content, /===\s*["'](?:sticky|text)["']/, name);
    assert.doesNotMatch(content, /["']sticky["']\s*:\s*["']text["']/, name);
    assert.doesNotMatch(content, /\[\s*["']sticky["']\s*,\s*["']text["']\s*\]/, name);
  }
});

test("state contains exactly the fourteen hooks named by 0001-W17 v1 through 0001-W24 v1", () => {
  assert.deepEqual(files(new URL("state/", source)).sort(), [
    "use-board-document.ts",
    "use-canvas-input.ts",
    "use-context-bar.ts",
    "use-editing-commands.ts",
    "use-editor-placement.ts",
    "use-geometry-edits.ts",
    "use-messages.ts",
    "use-object-layouts.ts",
    "use-page-keys.ts",
    "use-panel-layout.ts",
    "use-scene-size.ts",
    "use-selection.ts",
    "use-storage-session.ts",
    "use-viewport.ts",
  ]);
});

test("state hooks keep the licence header and never depend on App or screen parts", () => {
  const state = new URL("state/", source);
  for (const name of files(state)) {
    const content = readFileSync(new URL(name, state), "utf8");
    assert.equal(content.split("\n")[0], "// SPDX-License-Identifier: Apache-2.0", name);
    const declarations = content.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?["']([^"']+)["']/g);
    for (const declaration of declarations) {
      const module = declaration[1].replace(/\.(?:ts|tsx|js|jsx)$/, "");
      assert.doesNotMatch(module, /(?:^|\/)App$|\/ui\/|\/scene\//, name);
      assert.doesNotMatch(module, /^\.\//, `${name}: hooks must not import each other`);
    }
  }
});

test("only App.tsx imports or re-exports state", () => {
  for (const name of files(source).filter((name) => name !== "App.tsx")) {
    const content = readFileSync(new URL(name, source), "utf8");
    const declarations = content.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?["']([^"']+)["']/g);
    for (const declaration of declarations) {
      assert.doesNotMatch(declaration[1], /(?:^|\/)state\//, name);
    }
  }
});

test("context bar position is a rules module without React imports", () => {
  const content = readFileSync(new URL("context-bar-position.ts", source), "utf8");
  assert.doesNotMatch(content, /\bimport\s+(?:[^;]*?\s+from\s*)?["']react["']/);
});

test("the board document and messages hooks contain no effects", () => {
  for (const name of ["use-board-document.ts", "use-messages.ts"]) {
    const content = readFileSync(new URL("state/" + name, source), "utf8");
    assert.doesNotMatch(content, /\b(?:useEffect|useLayoutEffect)\b/, name);
  }
});

test("notice message is a rules module without React imports", () => {
  const content = readFileSync(new URL("notice-message.ts", source), "utf8");
  assert.doesNotMatch(content, /\bimport\s+(?:[^;]*?\s+from\s*)?["']react["']/);
});

test("the storage session hook holds exactly one passive effect", () => {
  const content = readFileSync(new URL("state/use-storage-session.ts", source), "utf8");
  assert.equal((content.match(/\buseEffect\s*\(/g) ?? []).length, 1);
  assert.doesNotMatch(content, /\buseLayoutEffect\b/);
});

test("the editing commands hook contains no effects", () => {
  const content = readFileSync(new URL("state/use-editing-commands.ts", source), "utf8");
  assert.doesNotMatch(content, /\b(?:useEffect|useLayoutEffect)\b/);
});

test("the viewport and scene size hooks each hold exactly one passive effect", () => {
  for (const name of ["use-viewport.ts", "use-scene-size.ts"]) {
    const content = readFileSync(new URL("state/" + name, source), "utf8");
    assert.equal((content.match(/\buseEffect\s*\(/g) ?? []).length, 1, name);
    assert.doesNotMatch(content, /\buseLayoutEffect\b/, name);
  }
});

test("the geometry edits hook contains no effects", () => {
  const content = readFileSync(new URL("state/use-geometry-edits.ts", source), "utf8");
  assert.doesNotMatch(content, /\b(?:useEffect|useLayoutEffect)\b/);
});

test("the canvas input hook holds exactly two passive effects", () => {
  const content = readFileSync(new URL("state/use-canvas-input.ts", source), "utf8");
  assert.equal((content.match(/\buseEffect\s*\(/g) ?? []).length, 2);
  assert.doesNotMatch(content, /\buseLayoutEffect\b/);
});

test("the page keys hook contains no effects", () => {
  const content = readFileSync(new URL("state/use-page-keys.ts", source), "utf8");
  assert.doesNotMatch(content, /\b(?:useEffect|useLayoutEffect)\b/);
});

test("the editor placement hook holds exactly three passive effects", () => {
  const content = readFileSync(new URL("state/use-editor-placement.ts", source), "utf8");
  assert.equal((content.match(/\buseEffect\s*\(/g) ?? []).length, 3);
  assert.doesNotMatch(content, /\buseLayoutEffect\b/);
});

test("the selection and object layouts hooks contain no effects", () => {
  for (const name of ["use-selection.ts", "use-object-layouts.ts"]) {
    const content = readFileSync(new URL("state/" + name, source), "utf8");
    assert.doesNotMatch(content, /\b(?:useEffect|useLayoutEffect)\b/, name);
  }
});
