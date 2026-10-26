// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { FLAGS, FLAG_LABELS, validMarks, normalize, toggle, formatted, formattedRange, codePointOffset, segments, remap } from "../apps/web/src/marks.ts";
const bold = (start, end) => ({ start, end, bold: true });
const italic = (start, end) => ({ start, end, italic: true });

test("format flags and labels have the specified order", () => {
  assert.deepEqual(FLAGS, ["bold", "italic", "strike"]);
  assert.deepEqual(FLAG_LABELS, { bold: "Bold", italic: "Italic", strike: "Strikethrough" });
});
test("normalized marks accept empty, different touching flags and combined flags", () => {
  assert(validMarks([], 0));
  assert(validMarks([bold(0, 1), italic(1, 2)], 2));
  assert(validMarks([{ ...bold(0, 2), italic: true, strike: true }], 2));
  assert(!validMarks(Array.from({ length: 1001 }, (_, i) => i % 2 ? italic(i, i + 1) : bold(i, i + 1)), 1001));
  assert(validMarks(Array.from({ length: 1000 }, (_, i) => i % 2 ? italic(i, i + 1) : bold(i, i + 1)), 1000));
});
test("invalid shape, ranges, flags, ordering, overlap and limits are rejected", () => {
  for (const value of [undefined, null, {}, "marks", [null], [1], [[]],
    [bold(0, 0)], [bold(2, 1)], [bold(0, 4)], [bold(-1, 1)], [bold(0.5, 1)], [bold(0, 1.5)],
    [{ start: 0, end: 1 }], [{ ...bold(0, 1), bold: false }], [{ ...bold(0, 1), italic: 1 }],
    [{ ...bold(0, 1), strike: undefined }], [{ ...bold(0, 1), extra: true }], [{ end: 1, bold: true }],
    [{ start: 0, bold: true }], [bold(2, 3), italic(0, 1)], [bold(0, 2), italic(1, 3)],
    [bold(0, 1), bold(1, 2)], Array.from({ length: 1001 }, (_, i) => bold(i * 2, i * 2 + 1)),
  ]) assert.equal(validMarks(value, 3), false, JSON.stringify(value));
});
test("normalize clips, merges equal neighbours and unions overlapping flags", () => {
  assert.deepEqual(normalize([], 0), []);
  assert.deepEqual(normalize([bold(0, 2), bold(2, 4)], 4), [bold(0, 4)]);
  assert.deepEqual(normalize([italic(1, 4), bold(-2, 3), bold(7, 8)], 3), [bold(0, 1), { ...bold(1, 3), italic: true }]);
});
test("toggle fills partial coverage, removes full coverage and preserves other flags", () => {
  const original = [bold(0, 1), italic(1, 3)];
  const added = toggle(original, 4, 0, 3, "bold");
  assert.deepEqual(added, [bold(0, 1), { ...bold(1, 3), italic: true }]);
  assert.deepEqual(toggle(added, 4, 0, 3, "bold"), [italic(1, 3)]);
  assert.deepEqual(toggle(original, 4, 2, 2, "strike"), original);
  assert.deepEqual(toggle([bold(0, 4)], 4, 1, 3, "bold"), [bold(0, 1), bold(3, 4)]);
});
test("formatted requires a nonempty text with complete coverage of that flag", () => {
  assert(formatted([bold(0, 3)], 3, "bold"));
  assert(formatted([bold(0, 1), { ...bold(1, 3), italic: true }], 3, "bold"));
  assert(!formatted([bold(0, 2)], 3, "bold"));
  assert(!formatted([bold(0, 3)], 3, "italic"));
  assert(!formatted([], 0, "bold"));
});
test("formattedRange requires complete coverage of a nonempty clipped range", () => {
  const marks = [bold(2, 6)];
  assert(formattedRange(marks, 8, 2, 6, "bold"));
  assert(formattedRange(marks, 8, 3, 5, "bold"));
  assert(!formattedRange(marks, 8, 1, 6, "bold"));
  assert(!formattedRange(marks, 8, 2, 6, "italic"));
  assert(!formattedRange(marks, 8, 3, 3, "bold"));
  assert(formattedRange([bold(0, 8)], 8, -2, 10, "bold"));
  assert(!formattedRange(marks, 8, 8, 10, "bold"));
});
test("codePointOffset converts textarea UTF-16 positions to code points", () => {
  assert.equal(codePointOffset("abc", 2), 2);
  assert.equal(codePointOffset("🧭 note", 2), 1);
  assert.equal(codePointOffset("🧭 note", 3), 2);
  assert.equal(codePointOffset("🧭 note", 7), 6);
  assert.equal(codePointOffset("", 0), 0);
});
test("segments includes plain runs and combines flags without splitting code points", () => {
  assert.deepEqual(segments("Alpha beta", [bold(6, 10)]), [{ text: "Alpha " }, { text: "beta", bold: true }]);
  assert.deepEqual(segments("🧭ab", [{ ...italic(0, 1), strike: true }]),
    [{ text: "🧭", italic: true, strike: true }, { text: "ab" }]);
  assert.deepEqual(segments("", []), []);
  assert.deepEqual(segments("plain", []), [{ text: "plain" }]);
  const text = "a🧭bc\nd";
  const runs = segments(text, [bold(0, 2), { ...bold(2, 3), italic: true }, italic(4, 5)]);
  assert.equal(runs.map((run) => run.text).join(""), text);
  assert.deepEqual(segments("ab", [bold(0, 1), bold(1, 2)]), [{ text: "ab", bold: true }]);
});
const edits = [
  ["before span", "abcd", "aXbcd", [bold(2, 3)], [bold(3, 4)]],
  ["inside span", "abcd", "abXcd", [bold(1, 3)], [bold(1, 4)]],
  ["after span", "abcd", "abcdX", [bold(1, 2)], [bold(1, 2)]],
  ["right after span", "abcd", "abXcd", [bold(0, 2)], [bold(0, 3)]],
  ["delete inside", "abcde", "abde", [bold(1, 4)], [bold(1, 3)]],
  ["delete across start", "abcde", "ade", [bold(2, 4)], [bold(1, 2)]],
  ["delete whole span", "abcde", "ae", [bold(1, 4)], []],
  ["astral code point", "🧭abc", "🧭aXbc", [italic(1, 3)], [italic(1, 4)]],
  ["insert at start", "abc", "Xabc", [bold(0, 1)], [bold(0, 2)]],
  ["empty old text", "", "X", [], []],
  ["no marks", "abc", "aXc", [], []],
  ["equal texts", "abc", "abc", [bold(1, 2)], [bold(1, 2)]],
  ["delete all", "abc", "", [bold(0, 3)], []],
  ["common prefix first flag", "aa", "a", [bold(0, 1)], [bold(0, 1)]],
  ["common prefix second flag", "aa", "a", [bold(1, 2)], []],
  ["replacement drops removed flags", "abc", "aXc", [italic(1, 2)], []],
  ["replacement inherits left flags", "abc", "aXc", [bold(0, 1), italic(1, 2)], [bold(0, 2)]],
];
for (const [name, before, after, marks, expected] of edits) test(`remap: ${name}`, () => {
  const original = structuredClone(marks), actual = remap(marks, before, after);
  assert.deepEqual(actual, expected);
  assert(validMarks(actual, Array.from(after).length));
  assert.deepEqual(marks, original);
});
