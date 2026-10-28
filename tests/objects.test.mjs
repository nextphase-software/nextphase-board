// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { OBJECT_TYPES, objectType, typeForTool, placementTool, containerType, isContainer } from "../apps/web/src/objects/registry.ts";
import { sticky } from "../apps/web/src/objects/sticky.ts";
import { section } from "../apps/web/src/objects/section.ts";
import { text } from "../apps/web/src/objects/text.ts";
import { COLORS, colorEntry, textUnits } from "../apps/web/src/styles.ts";

test("object types retain sticky and text order, labels and placement tools", () => {
  assert.deepEqual(OBJECT_TYPES.map((t) => t.type), ["sticky", "shape", "text", "section", "stroke", "connector"]);
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

test("v7 registry owns ends, rectangles, eligibility, bands and key sets", async () => {
  const { hasEnds, hasRectangle, hasPoints, sectionIdea, eligibleIdea, orderBand, typeWithEnds, ADD_OPTIONS, objectKeys } = await import("../apps/web/src/objects/registry.ts");
  const record = typeWithEnds();
  assert.equal(record, OBJECT_TYPES.at(-1)); assert.equal(record.type, "connector");
  assert.equal(record.tool, null); assert.equal(record.validFrom, 7);
  assert.equal(record.richText, false); assert.equal(record.container, false);
  assert.equal(record.textLimit, 100); assert.equal(record.initialText, "");
  assert.deepEqual(record.kinds, []); assert.equal(record.draws, false);
  assert.deepEqual(record.defaultStyle, { color: "neutral", textSize: "medium", align: "center" });
  assert.deepEqual(record.extraKeys, ["from", "to", "lineColor", "lineWeight", "lineDash", "startHead", "endHead", "lineShape"]);
  assert.equal(record.fontSize({}), 18); assert.equal(record.edge({}), "#6b6b6b");
  assert.equal(record.textColor({}), "#2c2c2c");
  for (const t of OBJECT_TYPES) {
    const o = { type: t.type };
    assert.equal(hasEnds(o), t.ends); assert.equal(hasRectangle(o), !t.ends);
    assert.equal(eligibleIdea(o), !t.ends && !t.container && !t.points);
    assert.equal(sectionIdea(o), !t.ends && !t.container);
    assert.equal(hasPoints(o), t.points);
    assert.equal(orderBand(o), t.container ? 0 : t.ends ? 1 : 2);
    assert.equal(objectKeys(t.type, 7).includes("x"), !t.ends);
  }
  assert(!ADD_OPTIONS.some((o) => o.type === record.type));
  assert.equal(placementTool("Connector"), undefined);
  assert.throws(() => typeForTool("Connector"));
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
    if (t.tool) { assert.equal(placementTool(t.tool), t); assert.equal(typeForTool(t.tool), t.type); }
    assert.equal(t.ends, t.type === "connector");
    assert.equal(isContainer({ type: t.type }), t.container);
  }
  assert.equal(placementTool("Pan"), undefined);
  for (const c of COLORS) {
    assert.equal(section.fill({ color: c.name }), c.fill);
    assert.equal(section.edge({ color: c.name }), c.edge);
    assert.equal(section.textColor({ color: c.name }), "#5f5b66");
  }
});

test("v6 records own extras, kinds, text boxes, font size, paint, growth and editor minima", async () => {
  const { shape, SHAPE_KINDS, ADD_OPTIONS, objectKeys, extraValues, kindForTool, toolForKey, labelPrefix, textBox, fontSize } = await import("../apps/web/src/objects/registry.ts");
  assert.equal(OBJECT_TYPES[1], shape); assert.equal(shape.tool, "Shapes");
  assert.equal(shape.validFrom, 6); assert.equal(shape.body, "shape-body");
  assert.equal(shape.container, false); assert.equal(shape.richText, true); assert.equal(shape.draws, true);
  assert.equal(shape.textLimit, 1000); assert.equal(shape.initialText, "");
  assert.deepEqual(shape.extraKeys, ["shape", "fill", "border"]);
  assert.deepEqual(shape.defaultSize, { width: 180, height: 180 });
  assert.deepEqual(shape.defaultStyle, { color: "neutral", textSize: "small", align: "center" });
  assert.equal(shape.previewRadius, 6); assert.deepEqual(shape.editorMinimum, { width: 40, height: 24 });
  for (const record of [sticky, text, section]) {
    assert.deepEqual(record.extraKeys, []); assert.deepEqual(record.defaults(), {});
    assert.equal(record.shapePaint, false); assert.equal(record.previewRadius, 0);
    assert.equal(record.growsWithText, record.richText);
    assert.deepEqual(record.editorMinimum, { width: 120, height: 60 });
    const item = { type: record.type, x: 10, y: 20, width: 180, height: 100, ...record.defaultStyle };
    assert.deepEqual(textBox(item), { x: 30, y: 40, width: 140, height: 60 });
    assert.equal(fontSize(item), 18); assert.equal(labelPrefix(item), record.type);
    assert.deepEqual(extraValues(item), {});
  }
  assert.equal(shape.growsWithText, false); assert.equal(shape.shapePaint, true);
  for (const k of SHAPE_KINDS) {
    assert.equal(placementTool(k.tool), shape); assert.equal(typeForTool(k.tool), shape.type);
    assert.equal(kindForTool(k.tool), k.kind); assert.equal(toolForKey(k.key.toLowerCase()), k.tool);
    assert.equal(labelPrefix({ type: shape.type, shape: k.kind }), k.kind);
  }
  assert.equal(toolForKey("s"), undefined); assert.equal(kindForTool("Sticky"), undefined);
  assert.equal(objectKeys(shape.type, 6).includes("fill"), true);
  for (let version = 1; version <= 5; version++) assert(!objectKeys(shape.type, version).includes("fill"));
  assert.deepEqual(ADD_OPTIONS.map((o) => o.label), ["sticky", "text", "square", "circle", "section"]);
});
