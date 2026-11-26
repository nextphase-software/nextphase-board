// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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

function webImportProblems(content, file = "") {
  return specifiers(content).filter((specifier) =>
    /(?:^|\/)packages\//.test(specifier) ||
    /(?:^|\/)server(?:\/|$)/.test(specifier) ||
    specifier.startsWith("nextphase-board-room") ||
    specifier === "nextphase-board-rules/transition.ts" ||
    specifier.startsWith("@supabase/") && !(specifier === "@supabase/auth-js" && file === "team/auth.ts") ||
    specifier.startsWith("nextphase-board-sync") && specifier !== "nextphase-board-sync/document-adapter.ts" &&
      !(specifier === "nextphase-board-sync/history.ts" && file === "team/history-rules.ts") &&
      !(specifier === "nextphase-board-sync/session.ts" && file === "team/hosted-board.ts") &&
      !(["nextphase-board-sync/comments.ts", "nextphase-board-sync/mentions.ts"].includes(specifier) && file === "team/comments/rules.ts") ||
    specifier.startsWith("nextphase-board-rules/") && !rulesParts.includes(specifier.slice("nextphase-board-rules/".length)));
}

test("the package holds exactly its modules", () => {
  assert.deepEqual(rulesParts, [
    "document.ts", "marks.ts", "objects/connector.ts", "objects/image.ts", "objects/link.ts", "objects/mind-node.ts", "objects/registry.ts",
    "objects/section.ts", "objects/shape.ts", "objects/sticky.ts", "objects/stroke.ts", "objects/table.ts", "objects/tape.ts", "objects/text.ts", "objects/video.ts",
    "platform.d.ts", "styles.ts", "text-link.ts", "transition.ts",
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
  for (const name of ["document.ts", "marks.ts", "styles.ts", "objects", "document-adapter.ts"]) {
    assert(!existsSync(new URL(name, source)), name);
  }
  let namesPackage = false;
  for (const name of files(source)) {
    const content = readFileSync(new URL(name, source), "utf8");
    assert.deepEqual(webImportProblems(content, name), [], name);
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

test("screen parts contain exactly the thirty-seven screen modules named through 0001-W27 v1", () => {
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
    "export-dialog.tsx",
    "file-bar.tsx",
    "find-bar.tsx",
    "format-preview.tsx",
    "image-controls.tsx",
    "information-button.tsx",
    "information-controls.tsx",
    "information-panel.tsx",
    "link-bar.tsx",
    "link-controls.tsx",
    "link-hover-card.tsx",
    "move-to-page.tsx",
    "navigation-panel.tsx",
    "notice.tsx",
    "objects-panel.tsx",
    "pages-panel.tsx",
    "palette.tsx",
    "save-area.tsx",
    "shape-controls.tsx",
    "shapes-panel.tsx",
    "stroke-controls.tsx",
    "table-controls.tsx",
    "tape-controls.tsx",
    "templates-panel.tsx",
    "tidy-up-bar.tsx",
    "zoom-controls.tsx",
  ]);
});

test("App.tsx stays within its extracted composition line budget", () => {
  const app = readFileSync(new URL("App.tsx", source), "utf8");
  const lines = (app.match(/\n/g) ?? []).length;
  assert(lines <= 264, `App.tsx has ${lines} newlines; budget is 264`);
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

test("scene parts contain exactly the twenty-two modules named through 0012-W5 v1", () => {
  assert.deepEqual(sceneParts, [
    "board-drawing.tsx",
    "connection-dots.tsx",
    "connector-body.tsx",
    "export-drawing.tsx",
    "find-rings.tsx",
    "gif-marks.tsx",
    "image-body.tsx",
    "inline-editor.tsx",
    "link-body.tsx",
    "mind-map-buttons.tsx",
    "mind-map-layer.tsx",
    "mind-node-body.tsx",
    "note-body.tsx",
    "overlays.tsx",
    "section-body.tsx",
    "shape-body.tsx",
    "stroke-body.tsx",
    "table-body.tsx",
    "table-buttons.tsx",
    "tape-body.tsx",
    "tidy-up-layer.tsx",
    "video-player.tsx",
  ]);
});

test("object types contain exactly the thirteen object-type modules named through 0012-W5 v1", () => {
  assert.deepEqual(objectTypes, ["connector.ts", "image.ts", "link.ts", "mind-node.ts", "registry.ts", "section.ts", "shape.ts", "sticky.ts", "stroke.ts", "table.ts", "tape.ts", "text.ts", "video.ts"]);
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
  for (const name of ["sticky", "text", "section", "shape", "square", "circle", "connector", "stroke", "table", "tape", "image", "video", "marker", "highlighter"]) {
    for (const operator of ["===", "!=="]) for (const quote of ['"', "'"]) {
      const literal = quote + name + quote;
      for (const comparison of [`o.type ${operator} ${literal}`, `${literal} ${operator} o.type`]) {
        assert(typeNameComparisons(`if (${comparison}) return;`).length > 0, comparison);
      }
    }
  }
  for (const source of ['const keys = ["type", "text"];', 'if (o.text === draft) return;', 'labelPrefix(o)', 'isVideoKind(assetKind(bytes))', 'importing === "with-videos"']) {
    assert.deepEqual(typeNameComparisons(source), [], source);
  }
});

test("state contains exactly the thirty hooks named through 0001-W27 v1", () => {
  assert.deepEqual(files(new URL("state/", source)).sort(), [
    "use-board-document.ts",
    "use-canvas-input.ts",
    "use-command-reasons.ts",
    "use-context-bar.ts",
    "use-editing-commands.ts",
    "use-editor-placement.ts",
    "use-export.ts",
    "use-find.ts",
    "use-geometry-edits.ts",
    "use-gesture-state.ts",
    "use-gif-playback.ts",
    "use-hosted-board.ts",
    "use-images.ts",
    "use-link-cards.ts",
    "use-messages.ts",
    "use-object-layouts.ts",
    "use-page-keys.ts",
    "use-pages.ts",
    "use-panel-layout.ts",
    "use-presence.ts",
    "use-scene-size.ts",
    "use-selection.ts",
    "use-session-status.ts",
    "use-storage-session.ts",
    "use-text-entry.ts",
    "use-text-links.ts",
    "use-tidy-up.ts",
    "use-validity.ts",
    "use-video-playback.ts",
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

test("state imports follow the single presence-layer exception", () => {
  const presenceImports = [];
  for (const name of files(source)) {
    const content = readFileSync(new URL(name, source), "utf8");
    const declarations = content.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?["']([^"']+)["']/g);
    for (const declaration of declarations) {
      if (/(?:^|\/)state\/use-presence(?:\.ts)?$/.test(declaration[1])) {
        presenceImports.push(name);
      } else if (name !== "App.tsx") assert.doesNotMatch(declaration[1], /(?:^|\/)state\//, name);
    }
  }
  assert.deepEqual(presenceImports, ["team/presence-layer.tsx"]);
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
    /[=!]==\s*["'](?:sticky|text|section|shape|square|circle|connector|stroke|table|tape|image|video|marker|highlighter)["']/,
    /["'](?:sticky|text|section|shape|square|circle|connector|stroke|table|tape|image|video|marker|highlighter)["']\s*[=!]==/,
  ].filter((pattern) => pattern.test(source));
}

function typeNameUses(source) {
  return [/\bsticky\b/].filter((pattern) => pattern.test(source)).concat(typeNameComparisons(source));
}

test("rules modules ask the registry instead of naming types", () => {
  const webRules = readdirSync(source).filter((name) => name.endsWith(".ts"));
  assert(!webRules.includes("document-adapter.ts"));
  assert(existsSync(new URL("../packages/board-sync/src/document-adapter.ts", import.meta.url)));
  const packageRules = readdirSync(rules).filter((name) => name.endsWith(".ts") && !name.endsWith(".d.ts")).sort();
  assert.deepEqual(packageRules, ["document.ts", "marks.ts", "styles.ts", "text-link.ts", "transition.ts"]);
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

function sharedImportProblems(content, file, folder, allowed) {
  return specifiers(content).filter((name) => {
    if (name.startsWith(".")) {
      const target = new URL(name, file);
      return !target.href.startsWith(folder.href) || !existsSync(target);
    }
    return !allowed.some((pkg) => name === pkg || name.startsWith(pkg + "/"));
  });
}

test("shared sync and room modules keep their import boundaries and licence headers", () => {
  for (const [name, allowed] of [
    ["board-sync", ["nextphase-board-rules", "yjs"]],
    ["board-room", ["nextphase-board-rules", "nextphase-board-sync", "yjs", "y-protocols", "lib0"]],
  ]) {
    const folder = new URL(`../packages/${name}/src/`, import.meta.url);
    for (const path of files(folder)) {
      const file = new URL(path, folder), content = readFileSync(file, "utf8");
      assert.equal(content.split("\n")[0], "// SPDX-License-Identifier: Apache-2.0", path);
      assert.deepEqual(sharedImportProblems(content, file, folder, allowed), [], path);
      assert.doesNotMatch(content.replace(/"[^"\n]*"|'[^'\n]*'/g, ""), /\b(?:window|document|Buffer|process|fetch|setTimeout|WebSocket|DurableObjectState)\b(?=\s*[.(])/);
    }
  }
});

test("web and shared import guards reject all new forbidden dependencies", () => {
  for (const name of ["nextphase-board-sync/codec.ts", "nextphase-board-room/room.ts",
    "nextphase-board-rules/transition.ts", "../../server/src/app.ts", "../../../apps/server/src/app.ts"]) {
    assert(webImportProblems(`import { value } from "${name}";`).length, name);
  }
  assert.deepEqual(webImportProblems('import { Adapter } from "nextphase-board-sync/document-adapter.ts";'), []);
  const folder = new URL("../packages/board-sync/src/", import.meta.url);
  for (const name of ["node:crypto", "hono", "nextphase-board-room/room.ts", "../../board-room/src/room.ts"]) {
    assert(sharedImportProblems(`export * from "${name}";`, new URL("codec.ts", folder), folder,
      ["nextphase-board-rules", "yjs"]).length, name);
  }
});

test("production runners contain none of the test driver names", () => {
  for (const name of ["node.ts", "worker.ts"]) {
    const content = readFileSync(new URL("../apps/server/src/" + name, import.meta.url), "utf8");
    assert.doesNotMatch(content, /driver-node|driver-workerd|node-test|worker-test|BOARD_TEST|\bfault\b|\binjectedClock\b/);
  }
});


test("team modules and imports follow web modules through 0012-W5 v1", () => {
  const team = new URL("team/", source);
  const names = files(team).sort();
  assert.deepEqual(names, ["api.ts", "auth.ts", "comments/card.tsx", "comments/icons.tsx", "comments/layer.tsx", "comments/mention-editor.tsx",
    "comments/panel.tsx", "comments/rules.ts", "comments/tool.tsx", "config.ts", "dialog.tsx", "history-panel.tsx", "history-rules.ts", "history.ts", "home-card.tsx", "home-import.tsx", "home-lists.ts",
    "home-menu.tsx", "home-rules.ts", "home.tsx", "hosted-board.ts", "import.ts", "lifecycle-rules.ts", "lifecycle.ts", "links.ts", "media-transfer.ts",
    "notices.ts", "notification-navigation.ts", "notifications.tsx", "page-presence.ts", "pages.tsx", "people.tsx", "pictures.ts", "presence-layer.tsx", "presence.ts", "reactions-layer.tsx", "reactions-rules.ts", "reactions.ts", "roles.ts", "share-dialog.tsx", "sign-in.tsx", "spotlight-layer.tsx", "spotlight-rules.ts", "spotlight.ts", "team-app.tsx", "templates-rules.ts", "templates-section.tsx", "templates.ts", "timer-panel.tsx", "timer-rules.ts", "timer.ts", "trash.tsx", "voting-card.tsx", "voting-overlay.tsx", "voting-rules.ts", "voting.ts", "workshop-panel.tsx"]);
  for (const name of names) {
    const content = readFileSync(new URL(name, team), "utf8");
    assert.equal(content.split("\n")[0], "// SPDX-License-Identifier: Apache-2.0", name);
    if (name === "import.ts") {
      assert(specifiers(content).every((specifier) => specifier === "../board-file.ts" || specifier.startsWith("nextphase-board-rules/")), name);
    }
    if (["templates-rules.ts", "reactions-rules.ts", "spotlight-rules.ts", "voting-rules.ts", "timer-rules.ts", "comments/rules.ts", "home-rules.ts", "lifecycle-rules.ts", "links.ts", "roles.ts", "notices.ts", "presence.ts"].includes(name)) {
      assert.doesNotMatch(content, /from ["'](?:react|.\/auth)/, name);
    }
  }
  for (const name of files(source).filter((name) => !name.startsWith("team/"))) {
    const content = readFileSync(new URL(name, source), "utf8");
    for (const declaration of content.matchAll(/\bimport\s+(?:(type)\s+)?[^;]*?from\s*["']([^"']+)["']/g)) {
      if (/\/team\//.test(declaration[2])) assert.equal(declaration[1], "type", name);
    }
    if (name !== "main.tsx") assert.doesNotMatch(content, /import\(["'][^"']*\/team\//, name);
  }
  const main = readFileSync(new URL("main.tsx", source), "utf8");
  assert.match(main, /if \(BOARD_TEAM_FEATURES\)\s*\{\s*void import\(["'].\/team\/team-app(?:\.tsx)?["']\)/);
  for (const module of ["nextphase-board-sync/session.ts", "nextphase-board-sync/comments.ts", "@supabase/auth-js"]) {
    const content = `import { value } from "${module}";`;
    const allowed = module.startsWith("@") ? "team/auth.ts" : module.endsWith("comments.ts") ? "team/comments/rules.ts" : "team/hosted-board.ts";
    assert.deepEqual(webImportProblems(content, allowed), []);
    for (const name of ["App.tsx", "state/use-hosted-board.ts", "team/config.ts"]) {
      assert(webImportProblems(content, name).length, name + module);
    }
  }
});

test("the hosted board hook holds exactly one passive effect", () => {
  const content = readFileSync(new URL("state/use-hosted-board.ts", source), "utf8");
  assert.equal((content.match(/\buseEffect\s*\(/g) ?? []).length, 1);
  assert.doesNotMatch(content, /\buseLayoutEffect\b/);
});

// Web modules v43, v45, v46, v50 and v51: exact existing-line substitutions from the behaviour baseline.
test("0001-W27 App composition changes only its recorded substitutions", () => {
  const base = execFileSync("git", ["show", "3f4ad48:apps/web/src/App.tsx"], { encoding: "utf8" });
  const substitutions = [
  [
    "import { Overlays } from \"./scene/overlays\"; import { ConnectionDots } from \"./scene/connection-dots\"; import { MindMapButtons } from \"./scene/mind-map-buttons\"; import { TidyUpLayer } from \"./scene/tidy-up-layer\"; import { TidyUpBar } from \"./ui/tidy-up-bar\"; import { FindRings } from \"./scene/find-rings\"; import { FindBar } from \"./ui/find-bar\"; import { PagesPanel } from \"./ui/pages-panel\"; import { MoveToPage } from \"./ui/move-to-page\";",
    "import { Overlays } from \"./scene/overlays\"; import { ConnectionDots } from \"./scene/connection-dots\"; import { MindMapButtons } from \"./scene/mind-map-buttons\"; import { TableButtons, TableCellStatus } from \"./scene/table-buttons\"; import { TidyUpLayer } from \"./scene/tidy-up-layer\"; import { TidyUpBar } from \"./ui/tidy-up-bar\"; import { FindRings } from \"./scene/find-rings\"; import { FindBar } from \"./ui/find-bar\"; import { PagesPanel } from \"./ui/pages-panel\"; import { MoveToPage } from \"./ui/move-to-page\";"
  ],
  [
    "  const { inline, setInline, composing, setComposing, textSelection, setTextSelection } = useTextEntry();",
    "  const { tableEntry, inline, setInline, composing, setComposing, textSelection, setTextSelection } = useTextEntry();"
  ],
  [
    "    tapeSelection, strokeSelection, connectorOnly, connectors, shapeSelection, selected, setSelected, selectionKey, selectedId, item, text,",
    "    tableSelection, tableAnnouncement, chooseTable, tableName, tapeSelection, strokeSelection, connectorOnly, connectors, shapeSelection, selected, setSelected, selectionKey, selectedId, item, text,"
  ],
  [
    "  const { invalidObjectText, invalidFields, invalid, pending } = useValidity({",
    "  const { cellInvalidNotice, invalidObjectText, invalidFields, invalid, pending } = useValidity({"
  ],
  [
    "    board, drafts, title, composing, busy: gestureBusy,",
    "    board, drafts, title, composing, busy: gestureBusy, cellDraft: tableEntry.draft?.text,"
  ],
  [
    "    editorBox, resolvedItem, growHeight, growAvailable, lineCount, objectLayouts, displayedObjects, allDisplayedObjects, bounds, selectedGroups, numbers,",
    "    tableMeasure, growTableRows, resolvedTable, editorBox, resolvedItem, growHeight, growAvailable, lineCount, objectLayouts, displayedObjects, allDisplayedObjects, bounds, selectedGroups, numbers,"
  ],
  [
    "    board: tidy.board, objects: pages.objects(tidy.board), selected: tidy.selected, selectedId, item, text, inline, textEditing: !!textSelection, invalidObjectText, tool, readOnly, composing, busy, drag,",
    "    tableDraft: tableEntry.draft, tableSelection, board: tidy.board, objects: pages.objects(tidy.board), selected: tidy.selected, selectedId, item, text, inline, textEditing: !!textSelection, invalidObjectText, tool, readOnly, composing, busy, drag,"
  ],
  [
    "    panel, setPanel, edit, toggle, editor, selector, templatesButton, firstTemplateButton, objectsButton, boardButton, navButton, infoButton,",
    "    tableEditorBox, revealCell, panel, setPanel, edit, toggle, editor, selector, templatesButton, firstTemplateButton, objectsButton, boardButton, navButton, infoButton,"
  ],
  [
    "    composing, busy, readOnly, pos,",
    "    composing, busy, readOnly, pos, tableCell: tableEntry.draft?.cell, setView,"
  ],
  [
    "    commitText, changeText, create, movedBoard, move, resizeStart,",
    "    tableGeometry, commitText, changeText, create, movedBoard, move, resizeStart,"
  ],
  [
    "    page: pages.id, shapeSession, model, commit, beginTextSession, finishTextSession, setDrafts, setMessage,",
    "    page: pages.id, tableEntry, tableMeasure, growTableRows, chooseTable, revealCell, shapeSession, model, commit, beginTextSession, finishTextSession, setDrafts, setMessage,"
  ],
  [
    "    preview, drawingCursor, dots, dotsVisible, connection, cancel, sceneKeyDown, pointerDown, pointerMove, pointerUp, doubleClick,",
    "    tableGesture, preview, drawingCursor, dots, dotsVisible, connection, cancel, sceneKeyDown, pointerDown, pointerMove, pointerUp, doubleClick,"
  ],
  [
    "    page: pages.id, voting: team?.hosted?.voting, drawing, tidy, find, connectorStyle, shapeSession, model, commit, setBoard, clearHistory, finishTextSession, setView, trackPointer,",
    "    page: pages.id, tableSelection, chooseTable, tableGeometry, tableAction: (action) => tableAction(action), voting: team?.hosted?.voting, drawing, tidy, find, connectorStyle, shapeSession, model, commit, setBoard, clearHistory, finishTextSession, setView, trackPointer,"
  ],
  [
    "  const { connectorCommands, strokeCommands, loadTemplates, templateCommands, templatePreviews, shapeCommands, setSection, objectClipboard, command, clipboardCommand, arrangementReason, arrange, changeStyle, toggleFormat } = useEditingCommands({",
    "  const { tableAction, tableSize, connectorCommands, strokeCommands, loadTemplates, templateCommands, templatePreviews, shapeCommands, setSection, objectClipboard, command, clipboardCommand, arrangementReason, arrange, changeStyle, toggleFormat } = useEditingCommands({"
  ],
  [
    "    pages, tool, connectorStyle, shapeSession, growHeight, growAvailable, model, commit, historyRef, updateHistory, setDrafts, finishTextSession,",
    "    pages, tableSelection, chooseTable, growTableRows, tool, connectorStyle, shapeSession, growHeight, growAvailable, model, commit, historyRef, updateHistory, setDrafts, finishTextSession,"
  ],
  [
    "  const hostedPaste = useHostedBoard({ hosted: team?.hosted, model, load, onChange: pages.changed, setBoard, setTitle, setDrafts, setReadOnly, setTool, setInline, select, paste: () => clipboardCommand(\"Paste\"), composing });",
    "  const hostedPaste = useHostedBoard({ hosted: team?.hosted, model, load, onChange: pages.changed, tables: { selection: tableSelection, entry: tableEntry, choose: chooseTable, setMessage, cancelDrag: tableGesture.cancelDrag, focus: tableGesture.focus, finish: finishTextSession, endComposition: tableEntry.endComposition }, setBoard, setTitle, setDrafts, setReadOnly, setTool, setInline, select, paste: () => clipboardCommand(\"Paste\"), composing });"
  ],
  [
    "    editor={editor} inline={inline} text={text} readOnly={readOnly} busy={busy} item={item}",
    "    tableEntry={tableEntry} tableName={tableName} cellInvalidNotice={cellInvalidNotice} setMessage={setMessage} editCell={tableGeometry.editCell} changeCell={tableGeometry.changeCell} finishCellComposition={tableGeometry.finishCellComposition} editor={editor} inline={inline} text={text} readOnly={readOnly} busy={busy} item={item}"
  ],
  [
    "          faded={find.faded} bitmaps={images.bitmaps} connection={connection} preview={preview} size={size} view={view} board={pages.canvas(tidy.board)} objectLayouts={objectLayouts} selected={tidy.selected} inline={inline} movingIds={busy && drag.current?.crossed ? drag.current.ids ?? [] : []}",
    "          tableSelection={tableSelection} tableCell={tableEntry.draft?.cell} tableGesture={tableGesture} faded={find.faded} bitmaps={images.bitmaps} connection={connection} preview={preview} size={size} view={view} board={pages.canvas(tidy.board)} objectLayouts={objectLayouts} selected={tidy.selected} inline={inline} movingIds={busy && drag.current?.crossed ? drag.current.ids ?? [] : []}"
  ],
  [
    "        <ConnectionDots dots={dots} connection={connection} objects={displayedObjects} pos={pos} zoom={view.z} /><MindMapButtons board={pages.canvas()} objects={displayedObjects} selected={selected} inline={inline} pos={pos} zoom={view.z} busy={busy} composing={composing} readOnly={readOnly} command={command} /><TidyUpLayer tidy={tidy} pos={pos} view={view} /><FindRings find={find} page={pages.id} pos={pos} zoom={view.z} />",
    "        <ConnectionDots dots={dots} connection={connection} objects={displayedObjects} pos={pos} zoom={view.z} /><MindMapButtons board={pages.canvas()} objects={displayedObjects} selected={selected} inline={inline} pos={pos} zoom={view.z} busy={busy} composing={composing} readOnly={readOnly} command={command} /><TableButtons object={resolvedTable} selection={tableSelection} editing={inline} busy={busy || composing || tool !== \"Select\" || tidy.open} readOnly={readOnly} zoom={view.z} pos={pos} size={size} ghost={tableGesture.ghost} action={tableAction} select={chooseTable} focus={tableGesture.focus} /><TableCellStatus announcement={tableAnnouncement} /><TidyUpLayer tidy={tidy} pos={pos} view={view} /><FindRings find={find} page={pages.id} pos={pos} zoom={view.z} />"
  ],
  [
    "        latestAcknowledgement={latestAcknowledgement} status={status} invalid={invalid} save={save}",
    "        latestAcknowledgement={latestAcknowledgement} status={status} invalid={invalid} save={tableEntry.exitBefore(save, finishTextSession)}"
  ],
  [
    "          contextTop={contextTop} item={item} selected={selected} readOnly={readOnly}",
    "          tableSelection={tableSelection} tableDraft={tableEntry.draft?.text} tableResizing={tableGesture.resizing} cellInvalidNotice={cellInvalidNotice} setMessage={setMessage} tableAction={tableAction} tableSize={tableSize} editCell={tableGeometry.editCell} contextTop={contextTop} item={item} selected={selected} readOnly={readOnly}"
  ],
  [
    "          view={view} itemHeight={itemHeight} text={text} nativeEditor={nativeEditor}",
    "          tableEditorBox={tableEditorBox} view={view} itemHeight={itemHeight} text={text} nativeEditor={nativeEditor}"
  ],
  [
    "  const { tableAction, tableSize, connectorCommands, strokeCommands, loadTemplates, templateCommands, templatePreviews, shapeCommands, setSection, objectClipboard, command, clipboardCommand, arrangementReason, arrange, changeStyle, toggleFormat } = useEditingCommands({",
    "  const { tableAction, tableSize, tableData, connectorCommands, strokeCommands, loadTemplates, templateCommands, templatePreviews, shapeCommands, setSection, objectClipboard, command, clipboardCommand, arrangementReason, arrange, changeStyle, toggleFormat } = useEditingCommands({"
  ],
  [
    "    pages, tableSelection, chooseTable, growTableRows, tool, connectorStyle, shapeSession, growHeight, growAvailable, model, commit, historyRef, updateHistory, setDrafts, finishTextSession,",
    "    pages, tableSelection, chooseTable, growTableRows, tableMeasure, tool, connectorStyle, shapeSession, growHeight, growAvailable, model, commit, historyRef, updateHistory, setDrafts, finishTextSession,"
  ],
  [
    "    command, clipboardCommand, toggleFormat, model, cancel, scene, busy, composing, select,",
    "    command, clipboardCommand, exportTable: tableData.exportTable, toggleFormat, model, cancel, scene, busy, composing, select,"
  ],
  [
    "        ref={scene} onPointerDownCapture={images.guardGesture} onPaste={hostedPaste ?? images.paste(() => clipboardCommand(\"Paste\"))} onDragOver={images.dragOver} onDrop={images.drop}",
    "        ref={scene} onPointerDownCapture={images.guardGesture} onPaste={tableData.paste(hostedPaste ?? images.paste(() => clipboardCommand(\"Paste\")))} onDragOver={images.dragOver} onDrop={tableData.drop(images.drop)}"
  ],
  [
    "          setPanel={setPanel} boardButton={boardButton} boardFiles={boardFiles} beginNameEntry={beginNameEntry} finishNameEntry={finishNameEntry}",
    "          setPanel={setPanel} boardButton={boardButton} boardFiles={boardFiles} importTable={tableData.importButton} beginNameEntry={beginNameEntry} finishNameEntry={finishNameEntry}"
  ],
  [
    "          tableSelection={tableSelection} tableDraft={tableEntry.draft?.text} tableResizing={tableGesture.resizing} cellInvalidNotice={cellInvalidNotice} setMessage={setMessage} tableAction={tableAction} tableSize={tableSize} editCell={tableGeometry.editCell} contextTop={contextTop} item={item} selected={selected} readOnly={readOnly}",
    "          tableSelection={tableSelection} tableDraft={tableEntry.draft?.text} tableResizing={tableGesture.resizing} cellInvalidNotice={cellInvalidNotice} setMessage={setMessage} tableAction={tableAction} tableSize={tableSize} exportTable={tableData.exportTable} editCell={tableGeometry.editCell} contextTop={contextTop} item={item} selected={selected} readOnly={readOnly}"
  ],
  [
    "import { useEditorPlacement } from \"./state/use-editor-placement\";",
    "import { useEditorPlacement } from \"./state/use-editor-placement\"; import { useExport } from \"./state/use-export\"; import { drawExport } from \"./scene/export-drawing\";"
  ],
  [
    "import { BoardQuestion } from \"./ui/board-question\";",
    "import { BoardQuestion } from \"./ui/board-question\"; import { ExportDialog } from \"./ui/export-dialog\";"
  ],
  [
    "  const { tableAction, tableSize, tableData, connectorCommands, strokeCommands, loadTemplates, templateCommands, templatePreviews, shapeCommands, setSection, objectClipboard, command, clipboardCommand, arrangementReason, arrange, changeStyle, toggleFormat } = useEditingCommands({",
    "  const exporter = useExport({ page: pages.id, board: pages.canvas(tidy.board), objects: displayedObjects, objectLayouts, selected, tableSelection, bitmaps: images.bitmaps, hosted: team?.hosted, busy, composing, tidyOpen: tidy.open, setMessage, scene, setPanel, boardButton, draw: drawExport }); const { tableAction, tableSize, tableData, connectorCommands, strokeCommands, loadTemplates, templateCommands, templatePreviews, shapeCommands, setSection, objectClipboard, command, clipboardCommand, arrangementReason, arrange, changeStyle, toggleFormat } = useEditingCommands({"
  ],
  [
    "    command, clipboardCommand, exportTable: tableData.exportTable, toggleFormat, model, cancel, scene, busy, composing, select,",
    "    command, clipboardCommand, openExport: exporter.open, toggleFormat, model, cancel, scene, busy, composing, select,"
  ],
  [
    "          setPanel={setPanel} boardButton={boardButton} boardFiles={boardFiles} importTable={tableData.importButton} beginNameEntry={beginNameEntry} finishNameEntry={finishNameEntry}",
    "          setPanel={setPanel} boardButton={boardButton} boardFiles={boardFiles} importTable={tableData.importButton} exportButton={exporter.button} beginNameEntry={beginNameEntry} finishNameEntry={finishNameEntry}"
  ],
  [
    "      <BoardQuestion {...boardQuestion} />",
    "      <BoardQuestion {...boardQuestion} /><ExportDialog {...exporter.dialog} />"
  ],
  ["import { ImageNames } from \"./scene/image-body\";", "import { ImageNames } from \"./scene/image-body\"; import { useGifPlayback } from \"./state/use-gif-playback\"; import { GifMarks } from \"./scene/gif-marks\";"],
  ["readOnly: readOnly || !!team?.hosted,", "readOnly, hosted: team?.hosted,"],
  ["pointerMove, pointerUp, doubleClick,", "pointerMove, pointerUp, doubleClick, hovered, pressedPlay, pointerLeave,"],
  ["textEditing: !!textSession.current, invalidObjectText,", "textEditing: !!textSession.current, invalidObjectText, animated: images.animated, bitmaps: images.bitmaps,"],
  ["  const exporter = useExport({", "  const gif = useGifPlayback({ objects: displayedObjects, selected, animated: images.animated, bitmaps: images.bitmaps, pressedPlay, setMessage }); const exporter = useExport({"],
  ["paste: () => clipboardCommand(\"Paste\"), composing });", "paste: () => clipboardCommand(\"Paste\"), pasteFiles: (files) => void images.pasted(files, () => clipboardCommand(\"Paste\")), composing });"],
  ["onLostPointerCapture={lostPointerCapture}", "onLostPointerCapture={lostPointerCapture} onPointerLeave={pointerLeave}"],
  ["bitmaps={images.bitmaps} connection", "bitmaps={images.bitmaps} loading={images.loading} playing={gif.playing} connection"],
  ["        <Overlays", "        <GifMarks objects={displayedObjects} animated={images.animated} bitmaps={images.bitmaps} selected={selected} hovered={hovered} pos={pos} zoom={view.z} /><Overlays"],
  ["busy={busy} tool={tool} readOnly={readOnly} snapshots={snapshots} reopen={reopen}", "busy={busy} tool={tool} readOnly={readOnly} snapshots={snapshots} reopen={reopen} importing={images.importing}"],
    ["import { GifMarks } from \"./scene/gif-marks\";", "import { GifMarks } from \"./scene/gif-marks\"; import { useVideoPlayback } from \"./state/use-video-playback\"; import { VideoPlayer } from \"./scene/video-player\";"],
    ["  const gif = useGifPlayback({", "  const video = useVideoPlayback({ opening: adapter.current, boardId: board.boardId, objects: displayedObjects, selected, bitmaps: images.bitmaps, pressedPlay, hosted: team?.hosted, hidden: tidy.open || find.open || (gestureBusy && !drag.current?.pan), setMessage }); const gif = useGifPlayback({"],
    ["zoom={view.z} /><Overlays", "zoom={view.z} /><VideoPlayer player={video.player} pos={pos} zoom={view.z} /><Overlays"],
    ["import { VideoPlayer } from \"./scene/video-player\";", "import { VideoPlayer } from \"./scene/video-player\"; import { useLinkCards } from \"./state/use-link-cards\";"],
    ["pasteFiles: (files) => void images.pasted(files, () => clipboardCommand(\"Paste\")), composing });", "pasteFiles: (files) => void images.pasted(files, () => clipboardCommand(\"Paste\")), composing }); const links = useLinkCards({ hosted: team?.hosted, page: pages.id, board, model, commit, select, selected, commandReason, tidyOpen: tidy.open, busy, composing, readOnly, editing: () => !!textSession.current, ownCopy: tableData.ownCopy, historyRef, updateHistory, lineCount, getView: () => view, scene, getStore: () => store.current, isAlive: () => alive.current });"],
    ["onPaste={tableData.paste(hostedPaste ?? images.paste(() => clipboardCommand(\"Paste\")))}", "onPaste={tableData.paste(links.paste(hostedPaste ?? images.paste(() => clipboardCommand(\"Paste\"))))}"],
    ["          tapeSelection={tapeSelection} tidy={tidy} board={pages.canvas()} moveToPage=", "          links={links.bar} tapeSelection={tapeSelection} tidy={tidy} board={pages.canvas()} moveToPage="],
    ["        infoButton={infoButton} panel={panel} busy={busy} composing={composing} toggle={toggle}", "        infoButton={infoButton} panel={panel} busy={busy} composing={composing} toggle={toggle} linkLine={links.aboutLine}"],
    ["import { useLinkCards } from \"./state/use-link-cards\";", "import { useLinkCards } from \"./state/use-link-cards\"; import { useTextLinks } from \"./state/use-text-links\"; import { LinkHoverCard } from \"./ui/link-hover-card\";"],
    ["getObjects: () => allDisplayedObjects,", "getObjects: () => allDisplayedObjects, getSelection: () => ({ ids: selected, settled: !busy }),"],
    ["edit, textEditing: !!textSession.current, invalidObjectText, animated: images.animated, bitmaps: images.bitmaps,", "edit, textEditing: !!textSession.current, invalidObjectText, animated: images.animated, bitmaps: images.bitmaps, linkPointer: () => textLinks.pointer,"],
    ["composing, busy, readOnly, pos, tableCell: tableEntry.draft?.cell, setView,", "composing, busy, readOnly, pos, tableCell: tableEntry.draft?.cell, setView, placed: (accepted) => textLinks.placed(accepted),"],
    ["command, clipboardCommand, openExport: exporter.open, toggleFormat,", "command, clipboardCommand, openExport: exporter.open, openLink: () => textLinks.shortcut(), toggleFormat,"],
    ["getView: () => view, scene, getStore: () => store.current, isAlive: () => alive.current });", "getView: () => view, scene, getStore: () => store.current, isAlive: () => alive.current }); const textLinks = useTextLinks({ hosted: team?.hosted, pages, board, model, commit, objects: displayedObjects, objectLayouts, selected, select, textSelection, inline, edit, editor, finishTextSession, scene, readOnly, busy, composing, tool, tidyOpen: tidy.open, barShown: size.w >= 768 && contextFits, selectionReason, ownCopy: tableData.ownCopy, view, size, pos, setMessage });"],
    ["setTextSelection={setTextSelection} toggleFormat={toggleFormat}", "setTextSelection={setTextSelection} toggleFormat={toggleFormat} links={textLinks.editor} textSelection={textSelection}"],
    ["<span id=\"selection-reason\" className=\"sr-only\">{selectionReason}</span>", "<span id=\"selection-reason\" className=\"sr-only\">{selectionReason}</span><span id=\"link-reason\" className=\"sr-only\">{textLinks.controls.link.own ? textLinks.controls.link.reason : \"\"}</span>"],
    ["links={links.bar} tapeSelection={tapeSelection}", "links={links.bar} textLinks={textLinks.controls} tapeSelection={tapeSelection}"],
    ["<BoardQuestion {...boardQuestion} /><ExportDialog {...exporter.dialog} />", "<BoardQuestion {...boardQuestion} /><ExportDialog {...exporter.dialog} /><LinkHoverCard card={textLinks.card} />"],
];
  let expected = base;
  for (const [from, to] of substitutions) {
    assert.equal(expected.split(from).length, 2, from);
    expected = expected.replace(from, to);
  }
  const app = readFileSync(new URL("App.tsx", source), "utf8");
  assert.equal(app, expected);
  assert.equal(app.split("\n").length, base.split("\n").length);
});
test("Pages owns exactly two passive effects", () => {
  const content = readFileSync(new URL("state/use-pages.ts", source), "utf8");
  assert.equal((content.match(/\buseEffect\s*\(/g) ?? []).length, 2);
  assert.doesNotMatch(content, /\buseLayoutEffect\b/);
});
test("Find owns exactly one passive effect", () => {
  const content = readFileSync(new URL("state/use-find.ts", source), "utf8");
  assert.equal((content.match(/\buseEffect\s*\(/g) ?? []).length, 1);
  assert.doesNotMatch(content, /\buseLayoutEffect\b/);
});
test("Tidy up owns at most two passive effects", () => {
  const content=readFileSync(new URL("state/use-tidy-up.ts",source),"utf8");
  assert((content.match(/\buseEffect\s*\(/g)??[]).length<=2);
  assert.doesNotMatch(content,/\buseLayoutEffect\b/);
});

test("sync package holds exactly the twelve modules of web modules v42", () => {
  assert.deepEqual(files(new URL("../packages/board-sync/src/", import.meta.url)).sort(), ["codec.ts", "comments.ts", "document-adapter.ts", "history.ts", "mentions.ts", "order-keys.ts", "reactions.ts", "session.ts", "spotlight.ts", "timer.ts", "undo.ts", "voting.ts"]);
});

test("video playback owns two effects and the scene owns none", () => {
  const hook = readFileSync(new URL("state/use-video-playback.ts", source), "utf8");
  assert.equal((hook.match(/\buseEffect\s*\(/g) ?? []).length, 2);
  assert.doesNotMatch(hook, /\buseLayoutEffect\b/);
  assert.doesNotMatch(readFileSync(new URL("scene/video-player.tsx", source), "utf8"), /\buse\w*\s*\(/);
});

test("the link cards hook holds exactly two passive effects", () => {
  const content = readFileSync(new URL("state/use-link-cards.ts", source), "utf8");
  assert.equal((content.match(/\buseEffect\s*\(/g) ?? []).length, 2);
  assert.doesNotMatch(content, /\buseLayoutEffect\b/);
});

test("the text links hook holds exactly two passive effects", () => {
  const content = readFileSync(new URL("state/use-text-links.ts", source), "utf8");
  assert.equal((content.match(/\buseEffect\s*\(/g) ?? []).length, 2);
  assert.doesNotMatch(content, /\buseLayoutEffect\b/);
});
