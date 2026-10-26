// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { OBJECT_TYPES, objectType, typeForTool, placementTool, containerType, isContainer } from "../apps/web/src/objects/registry.ts";
import { sticky } from "../apps/web/src/objects/sticky.ts";
import { section } from "../apps/web/src/objects/section.ts";
import { text } from "../apps/web/src/objects/text.ts";
import { COLORS, colorEntry, textUnits } from "../apps/web/src/styles.ts";

test("object types retain sticky and text order, labels and placement tools", () => {
  assert.deepEqual(OBJECT_TYPES.map((t) => t.type), ["sticky", "text", "section"]);
  assert.equal(objectType("sticky"), sticky);
  assert.equal(objectType("text"), text);
  assert.equal(objectType("sticky").label, "Sticky");
  assert.equal(objectType("text").label, "Text");
  assert.equal(typeForTool("Sticky"), "sticky");
  assert.equal(typeForTool("Text"), "text");
});

test("lookups reject values that no record has", () => {
  for (const type of ["", "unknown", "Sticky", "Text", "toString"]) {
    assert.throws(() => objectType(type), Error);
  }
  for (const tool of ["", "unknown", "sticky", "text", "Select"]) {
    assert.throws(() => typeForTool(tool), Error);
  }
});

for (const { name: color } of COLORS) {
  test(`${color} retains sticky fill and edge and no text fill or edge`, () => {
    assert.equal(sticky.fill({ color }), colorEntry(color).fill);
    assert.equal(sticky.edge({ color }), colorEntry(color).edge);
    assert.equal(text.fill({ color }), undefined);
    assert.equal(text.edge({ color }), undefined);
  });
}

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map((c) => parseInt(c, 16) / 255)
    .map((s) => s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
  return channels.reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

for (const { name: color } of COLORS) {
  test(`${color} retains sticky and text ink`, () => {
    assert.equal(sticky.textColor({ color }), "#28272c");
    assert.equal(text.textColor({ color }), colorEntry(color).text);
  });
}

test("every sticky and text colour meets WCAG normal-text contrast", () => {
  for (const c of COLORS) {
    assert(contrast(c.fill, sticky.textColor(c)) >= 4.5, c.name + " sticky");
    assert(contrast(text.textColor({ color: c.name }), "#fafafa") >= 4.5, c.name + " text");
  }
});
test("new and legacy defaults reproduce the previous appearance", () => {
  assert.deepEqual(sticky.defaultSize, { width: 240, height: 240 });
  assert.deepEqual(text.defaultSize, { width: 320, height: 120 });
  assert.deepEqual(sticky.defaultStyle, { color: "rose", textSize: "medium", align: "left" });
  assert.deepEqual(text.defaultStyle, { color: "neutral", textSize: "medium", align: "left" });
  assert.deepEqual(sticky.legacyStyle, sticky.defaultStyle);
  assert.deepEqual(text.legacyStyle, text.defaultStyle);
  assert.equal(colorEntry(sticky.defaultStyle.color).fill, "#f2dce5");
  assert.equal(colorEntry(sticky.defaultStyle.color).edge, "#e8cdd7");
  assert.equal(textUnits(sticky.defaultStyle.textSize), 18);
});

test("records own version, body, container, formatting, text and size rules", () => {
  for (const t of [sticky, text]) {
    assert.equal(t.validFrom, 1); assert.equal(t.body, "note");
    assert.equal(t.container, false); assert.equal(t.richText, true);
    assert.equal(t.textLimit, 1000); assert.equal(t.initialText, "");
    assert.deepEqual(t.sizeRange, { min: 40, max: 2000 }); assert.equal(t.draws, false);
  }
  assert.equal(objectType("section"), section); assert.equal(containerType(), section);
  assert.equal(section.validFrom, 5); assert.equal(section.body, "section");
  assert.equal(section.container, true); assert.equal(section.richText, false);
  assert.equal(section.textLimit, 100); assert.equal(section.initialText, "Section");
  assert.deepEqual(section.sizeRange, { min: 200, max: 10000 }); assert.equal(section.draws, true);
  assert.deepEqual(section.defaultSize, { width: 640, height: 480 });
  assert.deepEqual(section.defaultStyle, { color: "neutral", textSize: "medium", align: "left" });
  for (const t of OBJECT_TYPES) {
    assert.equal(placementTool(t.tool), t); assert.equal(typeForTool(t.tool), t.type);
    assert.equal(isContainer({ type: t.type }), t.container);
  }
  assert.equal(placementTool("Pan"), undefined);
  for (const c of COLORS) {
    assert.equal(section.fill({ color: c.name }), c.fill);
    assert.equal(section.edge({ color: c.name }), c.edge);
    assert.equal(section.textColor({ color: c.name }), "#5f5b66");
  }
});
