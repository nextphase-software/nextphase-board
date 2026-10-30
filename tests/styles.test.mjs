// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import {
  ALIGNMENTS, COLORS, TEXT_SIZES,
  colorEntry, commonStyle, textUnits,
} from "../packages/board-rules/src/styles.ts";

test("tables cover exactly the document v2 names and interaction v8 values", () => {
  assert.deepEqual(COLORS.map((c) => c.name), ["rose", "yellow", "orange", "green", "teal", "blue", "violet", "neutral"]);
  assert.deepEqual(TEXT_SIZES.map((s) => [s.name, s.units]), [
    ["small", 14], ["medium", 18], ["large", 24], ["extra-large", 32],
  ]);
  assert.deepEqual(ALIGNMENTS.map((a) => a.name), ["left", "center", "right"]);
  for (const color of COLORS) {
    assert.equal(colorEntry(color.name), color);
    assert.match(color.edge, /^#[0-9a-f]{6}$/);
  }
  for (const size of TEXT_SIZES) assert.equal(textUnits(size.name), size.units);
});

test("commonStyle returns a shared colour, text size or alignment and otherwise empty", () => {
  const object = { color: "rose", textSize: "medium", align: "left" };
  for (const [key, different] of [["color", "blue"], ["textSize", "large"], ["align", "right"]]) {
    assert.equal(commonStyle([object, { ...object }], key), object[key]);
    assert.equal(commonStyle([object, { ...object, [key]: different }], key), "");
    assert.equal(commonStyle([], key), "");
  }
});
