// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import {
  ALIGNMENTS, COLORS, DEFAULT_STYLES, LEGACY_STYLES, STICKY_TEXT, TEXT_SIZES,
  colorEntry, textColor, textUnits,
} from "../apps/web/src/styles.ts";

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map((c) => parseInt(c, 16) / 255)
    .map((s) => s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
  return channels.reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
test("tables cover exactly the document v2 names and interaction v8 values", () => {
  assert.deepEqual(COLORS.map((c) => c.name), ["rose", "yellow", "orange", "green", "teal", "blue", "violet", "neutral"]);
  assert.deepEqual(TEXT_SIZES.map((s) => [s.name, s.units]), [
    ["small", 14], ["medium", 18], ["large", 24], ["extra-large", 32],
  ]);
  assert.deepEqual(ALIGNMENTS.map((a) => a.name), ["left", "center", "right"]);
  for (const color of COLORS) {
    assert.equal(colorEntry(color.name), color);
    assert.match(color.edge, /^#[0-9a-f]{6}$/);
    assert.equal(textColor({ type: "sticky", ...DEFAULT_STYLES.sticky, color: color.name }), STICKY_TEXT);
    assert.equal(textColor({ type: "text", ...DEFAULT_STYLES.text, color: color.name }), color.text);
  }
  for (const size of TEXT_SIZES) assert.equal(textUnits(size.name), size.units);
});
test("every sticky and text colour meets WCAG normal-text contrast", () => {
  for (const c of COLORS) {
    assert(contrast(c.fill, STICKY_TEXT) >= 4.5, c.name + " sticky");
    assert(contrast(c.text, "#fafafa") >= 4.5, c.name + " text");
  }
});
test("new and legacy defaults reproduce the previous appearance", () => {
  assert.deepEqual(DEFAULT_STYLES, {
    sticky: { color: "rose", textSize: "medium", align: "left" },
    text: { color: "neutral", textSize: "medium", align: "left" },
  });
  assert.deepEqual(LEGACY_STYLES, DEFAULT_STYLES);
  assert.equal(colorEntry(DEFAULT_STYLES.sticky.color).fill, "#f2dce5");
  assert.equal(colorEntry(DEFAULT_STYLES.sticky.color).edge, "#e8cdd7");
  assert.equal(textUnits(DEFAULT_STYLES.sticky.textSize), 18);
});
