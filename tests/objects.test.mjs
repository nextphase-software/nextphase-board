// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { OBJECT_TYPES, objectType, typeForTool } from "../apps/web/src/objects/registry.ts";
import { sticky } from "../apps/web/src/objects/sticky.ts";
import { text } from "../apps/web/src/objects/text.ts";
import { COLORS, colorEntry } from "../apps/web/src/styles.ts";

test("object types retain sticky and text order, labels and placement tools", () => {
  assert.deepEqual(OBJECT_TYPES.map((t) => t.type), ["sticky", "text"]);
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
