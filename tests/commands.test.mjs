// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { editingCommandReason } from "../apps/web/src/commands.ts";

const available = {
  readOnly: false,
  composing: false,
  pointerGesture: false,
  invalidObjectText: false,
};

test("editing commands have no reason when nothing blocks them", () => {
  assert.equal(editingCommandReason(available), "");
});

const blockers = [
  ["readOnly", "Read-only: editing commands are unavailable."],
  ["composing", "Finish text composition before using editing commands."],
  ["pointerGesture", "Finish or cancel the pointer gesture before using editing commands."],
  ["invalidObjectText", "Correct invalid drafts before using editing commands."],
];

for (const [key, reason] of blockers) {
  test(`${key} alone gives the existing reason`, () => {
    assert.equal(editingCommandReason({ ...available, [key]: true }), reason);
  });
}

for (let i = 0; i < blockers.length - 1; i++) {
  const [key, reason] = blockers[i];
  test(`${key} takes precedence over all later blockers`, () => {
    const active = Object.fromEntries(blockers.slice(i).map(([name]) => [name, true]));
    assert.equal(editingCommandReason({ ...available, ...active }), reason);
  });
}
