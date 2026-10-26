// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { graphemes, layoutRuns, lineOffset } from "../apps/web/src/text-runs.ts";
const measure = (text, style) => graphemes(text).length * (style.bold ? 12 : 10);
const wrap = (text, width, marks = []) => layoutRuns(text, marks, width, measure);
const texts = (lines) => lines.map((line) => line.pieces.map((piece) => piece.text).join(""));
for (const [name, text, width, expected] of [
  ["fitting untrimmed paragraph", " abc ", 60, [" abc "]],
  ["space break", "one two", 45, ["one", "two"]],
  ["hyphen and long word", "one-two three", 45, ["one-", "two", "thre", "e"]],
  ["long word", "abcdefghij", 45, ["abcd", "efgh", "ij"]],
  ["empty paragraph", "a\n\nb", 45, ["a", "", "b"]],
  ["empty text", "", 45, [""]],
  ["drop spaces at break", "abc   def", 45, ["abc", "def"]],
  ["keep leading spaces", "  abcdef", 45, ["", "abcd", "ef"]],
  ["nothing fits", "abc", 5, []],
  ["en dash is not a break", "ab–cdef", 45, ["ab–c", "def"]],
  ["hyphen-minus is a break", "ab-cdef", 45, ["ab-", "cdef"]],
  ["no-break space is not a break", "ab\u00a0cdef", 45, ["ab\u00a0c", "def"]],
  ["tab at break", "abc\tdef", 35, ["abc", "def"]],
]) test(`run wrapping: ${name}`, () => assert.deepEqual(texts(wrap(text, width)), expected));

test("leading whitespace is preserved on a wrapped line before its word", () => {
  assert.deepEqual(texts(wrap("  ab cdef", 65)), ["  ab", "cdef"]);
});
test("pieces carry styles and measured positions within each line", () => {
  assert.deepEqual(wrap("abcd", 100, [{ start: 1, end: 3, bold: true, italic: true, strike: true }]), [{
    width: 44, pieces: [
      { text: "a", style: {}, x: 0, width: 10 },
      { text: "bc", style: { bold: true, italic: true, strike: true }, x: 10, width: 24 },
      { text: "d", style: {}, x: 34, width: 10 },
    ],
  }]);
});
test("equal-style spans are measured together, including font kerning", () => {
  const calls = [];
  const lines = layoutRuns("AVx", [{ start: 0, end: 2, bold: true }], 100, (text, style) => {
    calls.push([text, style]); return text === "AV" ? 17 : 10;
  });
  assert.deepEqual(calls, [["AV", { bold: true }], ["x", {}]]);
  assert.equal(lines[0].width, 27);
});
test("bold wraps sooner than unformatted text", () => {
  assert.deepEqual(texts(wrap("abcdef", 45)), ["abcd", "ef"]);
  assert.deepEqual(texts(wrap("abcdef", 45, [{ start: 0, end: 6, bold: true }])), ["abc", "def"]);
});
test("marks use code point offsets across paragraph separators", () => {
  const lines = wrap("🧭a\nbc", 100, [{ start: 1, end: 4, italic: true }]);
  assert.deepEqual(lines[0].pieces.map((p) => [p.text, p.style]), [["🧭", {}], ["a", { italic: true }]]);
  assert.deepEqual(lines[1].pieces.map((p) => [p.text, p.style]), [["b", { italic: true }], ["c", {}]]);
});
test("grapheme clusters take only their first code point's formatting", () => {
  const family = "👨‍👩‍👧‍👦";
  assert.deepEqual(graphemes(`🇺🇸e\u0301${family}👍🏽`), ["🇺🇸", "e\u0301", family, "👍🏽"]);
  assert.deepEqual(wrap(family + "x", 15, [{ start: 1, end: 6, bold: true }]), [
    { width: 10, pieces: [{ text: family, style: {}, x: 0, width: 10 }] },
    { width: 10, pieces: [{ text: "x", style: {}, x: 0, width: 10 }] },
  ]);
  assert.deepEqual(wrap(family, 15, [{ start: 0, end: 1, strike: true }])[0].pieces[0].style, { strike: true });
});
test("alignment offsets use each line's free width", () => {
  assert.equal(lineOffset("left", 100, 40), 0);
  assert.equal(lineOffset("center", 100, 40), 30);
  assert.equal(lineOffset("right", 100, 40), 60);
});
