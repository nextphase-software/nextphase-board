// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

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
const rules = new URL("../packages/board-rules/src/", import.meta.url);
const objects = new URL("objects/", rules);
const objectTypes = files(objects).sort();
const objectContents = objectTypes.map((name) => [name, readFileSync(new URL(name, objects), "utf8")]);
const rulesParts = files(rules).sort();
const rulesContents = rulesParts.map((name) => [name, readFileSync(new URL(name, rules), "utf8")]);

function specifiers(content) {
  return Array.from(content.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g), (match) => match[1] ?? match[2]);
}

function rulesImportProblems(content, file) {
  return specifiers(content).filter((specifier) => {
    if (!specifier.startsWith(".")) return true;
    const target = new URL(specifier, file);
    return !target.href.startsWith(rules.href) || !existsSync(target);
  });
}

function webImportProblems(content) {
  return specifiers(content).filter((specifier) =>
    /(?:^|\/)packages\//.test(specifier) ||
    specifier.startsWith("nextphase-board-rules/") && !rulesParts.includes(specifier.slice("nextphase-board-rules/".length)));
}

test("the package holds exactly its modules", () => {
  assert.deepEqual(rulesParts, [
    "document.ts", "marks.ts", "objects/connector.ts", "objects/image.ts", "objects/registry.ts",
    "objects/section.ts", "objects/shape.ts", "objects/sticky.ts", "objects/stroke.ts", "objects/text.ts",
    "platform.d.ts", "styles.ts",
  ]);
  for (const [name, content] of rulesContents) {
    assert.equal(content.split("\n")[0], "// SPDX-License-Identifier: Apache-2.0", name);
  }
});

test("board rules import only their own files", () => {
  for (const [name, content] of rulesContents) {
    assert.deepEqual(rulesImportProblems(content, new URL(name, rules)), [], name);
  }
});

test("the web app keeps no copy and imports by name", () => {
  for (const name of ["document.ts", "marks.ts", "styles.ts", "objects"]) {
    assert(!existsSync(new URL(name, source)), name);
  }
  let namesPackage = false;
  for (const name of files(source)) {
    const content = readFileSync(new URL(name, source), "utf8");
    assert.deepEqual(webImportProblems(content), [], name);
    namesPackage ||= specifiers(content).some((specifier) => specifier.startsWith("nextphase-board-rules/"));
  }
  assert(namesPackage, "The web app must import the board rules package");
});

test("the import guards catch each forbidden form", () => {
  const document = new URL("document.ts", rules);
  for (const content of [
    'import * as Y from "yjs";',
    'import { history } from "../../../apps/web/src/history.ts";',
    'export { clamp } from "../../../scripts/build-web.mjs";',
    'type T = typeof import("nextphase-board-rules/document.ts");',
    'import { history } from "../history.ts";',
  ]) {
    assert(rulesImportProblems(content, document).length > 0, content);
  }
  for (const content of [
    'import { colorEntry } from "../styles.ts";',
    'export * from "./shape.ts";',
  ]) {
    assert.deepEqual(rulesImportProblems(content, new URL("objects/text.ts", rules)), [], content);
  }
  assert.deepEqual(rulesImportProblems('type T = typeof import("./objects/image.ts");', document), []);
  for (const content of [
    'import { add } from "../../../packages/board-rules/src/document.ts";',
    'import { add } from "../../packages/board-rules/src/document";',
    'import { add } from "nextphase-board-rules/history.ts";',
  ]) {
    assert(webImportProblems(content).length > 0, content);
  }
  for (const content of [
    'import { add } from "nextphase-board-rules/document.ts";',
    'import type { Rectangle } from "nextphase-board-rules/objects/registry.ts";',
    'import { record } from "../history";',
  ]) {
    assert.deepEqual(webImportProblems(content), [], content);
  }
});

test("screen parts contain exactly the twenty-seven screen modules named through 0002-W3 v1", () => {
  assert.deepEqual(screenParts, [
    "arrange-controls.tsx",
    "board-panel.tsx",
    "board-question.tsx",
    "boards-list.tsx",
    "connector-controls.tsx",
    "connector-fields.tsx",
    "connector-icons.tsx",
    "connector-menu.tsx",
    "content-field.tsx",
    "context-bar.tsx",
    "drawing-tools.tsx",
    "file-bar.tsx",
    "format-preview.tsx",
    "image-controls.tsx",
    "information-button.tsx",
    "information-controls.tsx",
    "information-panel.tsx",
    "navigation-panel.tsx",
    "notice.tsx",
    "objects-panel.tsx",
    "palette.tsx",
    "save-area.tsx",
    "shape-controls.tsx",
    "shapes-panel.tsx",
    "stroke-controls.tsx",
    "templates-panel.tsx",
    "zoom-controls.tsx",
  ]);
});

test("App.tsx stays within its extracted composition line budget", () => {
  const app = readFileSync(new URL("App.tsx", source), "utf8");
  const lines = (app.match(/\n/g) ?? []).length;
  assert(lines <= 262, `App.tsx has ${lines} newlines; budget is 262`);
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

test("scene parts contain exactly the ten modules named through 0009-W1 v1", () => {
  assert.deepEqual(sceneParts, [
    "board-drawing.tsx",
    "connection-dots.tsx",
    "connector-body.tsx",
    "image-body.tsx",
    "inline-editor.tsx",
    "note-body.tsx",
    "overlays.tsx",
    "section-body.tsx",
    "shape-body.tsx",
    "stroke-body.tsx",
  ]);
});

test("object types contain exactly the eight object-type modules named through 0009-W1 v1", () => {
  assert.deepEqual(objectTypes, ["connector.ts", "image.ts", "registry.ts", "section.ts", "shape.ts", "sticky.ts", "stroke.ts", "text.ts"]);
});

test("object types never import React or Konva", () => {
  for (const [name, content] of objectContents) {
    assert.doesNotMatch(content, /\bimport\s+(?:[^;]*?\s+from\s*)?["'](?:react|react-konva|konva)["']/, name);
  }
});

test("composition and screen parts ask the registry instead of comparing type names", () => {
  const app = readFileSync(new URL("App.tsx", source), "utf8");
  for (const [name, content] of [["App.tsx", app], ...contents, ...sceneContents]) {
    assert.deepEqual(typeNameComparisons(content), [], name);
    assert.doesNotMatch(content, /["']sticky["']\s*:\s*["']text["']/, name);
    assert.doesNotMatch(content, /\[\s*["']sticky["']\s*,\s*["']text["']\s*\]/, name);
  }
});

test("screen and scene guard detects equality and inequality in both operand orders", () => {
  for (const name of ["sticky", "text", "section", "shape", "square", "circle", "connector", "stroke", "image", "marker", "highlighter"]) {
    for (const operator of ["===", "!=="]) for (const quote of ['"', "'"]) {
      const literal = quote + name + quote;
      for (const comparison of [`o.type ${operator} ${literal}`, `${literal} ${operator} o.type`]) {
        assert(typeNameComparisons(`if (${comparison}) return;`).length > 0, comparison);
      }
    }
  }
  for (const source of ['const keys = ["type", "text"];', 'if (o.text === draft) return;', 'labelPrefix(o)']) {
    assert.deepEqual(typeNameComparisons(source), [], source);
  }
});

test("state contains exactly the twenty hooks named by 0001-W17 v1 through 0001-W25 v1", () => {
  assert.deepEqual(files(new URL("state/", source)).sort(), [
    "use-board-document.ts",
    "use-canvas-input.ts",
    "use-command-reasons.ts",
    "use-context-bar.ts",
    "use-editing-commands.ts",
    "use-editor-placement.ts",
    "use-geometry-edits.ts",
    "use-gesture-state.ts",
    "use-images.ts",
    "use-messages.ts",
    "use-object-layouts.ts",
    "use-page-keys.ts",
    "use-panel-layout.ts",
    "use-scene-size.ts",
    "use-selection.ts",
    "use-session-status.ts",
    "use-storage-session.ts",
    "use-text-entry.ts",
    "use-validity.ts",
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

test("the storage session hook holds lifecycle and opening-focus passive effects", () => {
  const content = readFileSync(new URL("state/use-storage-session.ts", source), "utf8");
  assert.equal((content.match(/\buseEffect\s*\(/g) ?? []).length, 2);
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

test("the five hooks added by 0001-W25 v1 contain no effects", () => {
  for (const name of [
    "use-command-reasons.ts", "use-gesture-state.ts", "use-session-status.ts",
    "use-text-entry.ts", "use-validity.ts",
  ]) {
    const content = readFileSync(new URL("state/" + name, source), "utf8");
    assert.doesNotMatch(content, /\b(?:useEffect|useLayoutEffect)\b/, name);
  }
});

function compositionProblems(source) {
  const problems = [];
  const stateHooks = new Set();
  const declarations = source.matchAll(/\bimport\s+(?:(type)\s+)?(?:([^;]*?)\s+from\s*)?["']([^"']+)["']/g);
  for (const declaration of declarations) {
    const [, type, bindings = "", module] = declaration;
    if (type) continue;
    if (module === "react") problems.push("React value import");
    const names = bindings.replace(/[{}]/g, "").split(",");
    for (const binding of names) {
      const name = binding.trim();
      if (!name || /^type\s/.test(name)) continue;
      const [imported, local = imported] = name.split(/\s+as\s+/);
      if (module.startsWith("./state/")) stateHooks.add(local);
      else if (/^use[A-Z]/.test(imported) || /^use[A-Z]/.test(local)) {
        problems.push(`Hook value import outside state: ${name}`);
      }
    }
  }
  const calls = source.matchAll(/\b(use[A-Z]\w*)\s*(?:<[^()]*?>)?\s*\(/g);
  for (const call of calls) {
    if (!stateHooks.has(call[1])) problems.push(`Hook call outside state: ${call[1]}`);
  }
  return problems;
}

test("App.tsx is composition only", () => {
  const app = readFileSync(new URL("App.tsx", source), "utf8");
  assert.deepEqual(compositionProblems(app), []);
});

test("composition guard detects each forbidden form and allows state hooks and React types", () => {
  for (const source of [
    'import { createElement } from "react";',
    'import { useThing as thing } from "./ui/thing";',
    'useThing<number>();',
    'import { useSelection } from "./state/use-selection"; useSelection(); useOther();',
    'import { useThing } from "./ui/thing"; useThing<number>();',
  ]) {
    assert(compositionProblems(source).length > 0, source);
  }
  for (const source of [
    'import type { CSSProperties } from "react";',
    'import { useSelection } from "./state/use-selection"; useSelection<number>({});',
  ]) {
    assert.deepEqual(compositionProblems(source), [], source);
  }
});

test("object types import only siblings or styles, which never imports object types", () => {
  for (const [name, content] of objectContents) {
    const declarations = content.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?["']([^"']+)["']/g);
    for (const declaration of declarations) {
      assert.match(declaration[1], /^(?:\.\/[^/]+\.ts|\.\.\/styles\.ts)$/, name);
    }
  }
  const styles = readFileSync(new URL("styles.ts", rules), "utf8");
  const declarations = styles.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?["']([^"']+)["']/g);
  for (const declaration of declarations) {
    assert.doesNotMatch(declaration[1], /(?:^|\/)objects(?:\/|$)/);
  }
});

function typeNameComparisons(source) {
  return [
    /[=!]==\s*["'](?:sticky|text|section|shape|square|circle|connector|stroke|image|marker|highlighter)["']/,
    /["'](?:sticky|text|section|shape|square|circle|connector|stroke|image|marker|highlighter)["']\s*[=!]==/,
  ].filter((pattern) => pattern.test(source));
}

function typeNameUses(source) {
  return [/\bsticky\b/].filter((pattern) => pattern.test(source)).concat(typeNameComparisons(source));
}

test("rules modules ask the registry instead of naming types", () => {
  const webRules = readdirSync(source).filter((name) => name.endsWith(".ts"));
  assert(webRules.includes("document-adapter.ts"));
  const packageRules = readdirSync(rules).filter((name) => name.endsWith(".ts") && !name.endsWith(".d.ts")).sort();
  assert.deepEqual(packageRules, ["document.ts", "marks.ts", "styles.ts"]);
  for (const name of [...webRules, ...files(new URL("state/", source)).map((n) => "state/" + n)]) {
    assert.deepEqual(typeNameUses(readFileSync(new URL(name, source), "utf8")), [], name);
  }
  for (const name of packageRules) {
    assert.deepEqual(typeNameUses(readFileSync(new URL(name, rules), "utf8")), [], name);
  }
});

test("rules type-name guard detects each forbidden form and allows text fields", () => {
  for (const source of [
    'type: "sticky" | "text";',
    'const width = type === "sticky" ? 240 : 320;',
    '!["sticky", "text"].includes(o.type)',
    'const DEFAULT = { sticky: { color: "rose" } };',
    'if (o.type !== "text") return;',
    'if ("text" === o.type) return;',
    'if (o.type === "section") return;',
    'if ("section" !== o.type) return;',
    'if (o.type === "shape") return;',
    'if (o.type === "connector") return;',
    'if ("connector" !== o.type) return;',
    'if (o.type === "stroke") return;',
    'if (o.type === "image") return;',
    'if (o.kind === "marker") return;',
    'if ("highlighter" !== o.kind) return;',
    'if (o.shape !== "square") return;',
    'if ("circle" === o.shape) return;',
  ]) {
    assert(typeNameUses(source).length > 0, source);
  }
  for (const source of [
    'const keys = ["id", "type", "text"];',
    'let text = m.get("text");',
    'objects.map(({ type, text }) => ({ type, text }))',
    'const STICKY_TEXT = "#28272c";',
  ]) {
    assert.deepEqual(typeNameUses(source), [], source);
  }
});


test("rules modules never import React or Konva", () => {
  const webRules = files(source).filter((name) => !name.includes("/") && name.endsWith(".ts"));
  assert(webRules.length > 0);
  const webContents = webRules.map((name) => [name, readFileSync(new URL(name, source), "utf8")]);
  for (const [name, content] of [...webContents, ...rulesContents]) {
    assert.doesNotMatch(content, /\bimport\s+(?:[^;]*?\s+from\s*)?["'](?:react|react-dom|react-konva|konva)(?:\/[^"']*)?["']/, name);
  }
});
