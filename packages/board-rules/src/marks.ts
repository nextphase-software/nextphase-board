// SPDX-License-Identifier: Apache-2.0
export const FLAGS = ["bold", "italic", "strike"] as const;
export type Flag = typeof FLAGS[number];
export const FLAG_LABELS: Record<Flag, string> = {
  bold: "Bold", italic: "Italic", strike: "Strikethrough",
};
export type Mark = { start: number; end: number; bold?: true; italic?: true; strike?: true };
export type TextSelection = { id: string; start: number; end: number };

function mask(mark: Pick<Mark, Flag>): number {
  return FLAGS.reduce((bits, flag, i) => bits | (mark[flag] ? 1 << i : 0), 0);
}
function flags(bits: number): Pick<Mark, Flag> {
  return {
    ...(bits & 1 ? { bold: true as const } : {}),
    ...(bits & 2 ? { italic: true as const } : {}),
    ...(bits & 4 ? { strike: true as const } : {}),
  };
}
function coverage(marks: readonly Mark[], length: number): number[] {
  const points = Array<number>(length).fill(0);
  for (const mark of marks) {
    for (let i = Math.max(0, mark.start); i < Math.min(length, mark.end); i++) points[i] |= mask(mark);
  }
  return points;
}
function spans(points: readonly number[]): Mark[] {
  const result: Mark[] = [];
  for (let start = 0; start < points.length;) {
    let end = start + 1;
    while (end < points.length && points[end] === points[start]) end++;
    if (points[start]) result.push({ start, end, ...flags(points[start]) });
    start = end;
  }
  return result;
}
export function validMarks(value: unknown, length: number): value is Mark[] {
  if (!Array.isArray(value) || value.length > 1000) return false;
  let previous: Mark | undefined;
  for (const mark of value) {
    if (!mark || typeof mark !== "object" || Array.isArray(mark) ||
      !Object.hasOwn(mark, "start") || !Object.hasOwn(mark, "end") ||
      !Number.isInteger(mark.start) || !Number.isInteger(mark.end) ||
      mark.start < 0 || mark.end <= mark.start || mark.end > length ||
      Object.keys(mark).some((key) => key !== "start" && key !== "end" && !FLAGS.includes(key as Flag)) ||
      FLAGS.some((flag) => Object.hasOwn(mark, flag) && mark[flag] !== true) ||
      !FLAGS.some((flag) => mark[flag] === true) ||
      (previous && (mark.start < previous.end || mark.start === previous.end && mask(mark) === mask(previous)))) {
      return false;
    }
    previous = mark;
  }
  return true;
}
export function normalize(marks: readonly Mark[], length: number): Mark[] {
  return spans(coverage(marks, length));
}
export function toggle(marks: readonly Mark[], length: number, start: number, end: number, flag: Flag): Mark[] {
  const points = coverage(marks, length), bit = 1 << FLAGS.indexOf(flag);
  start = Math.max(0, start); end = Math.min(length, end);
  const remove = points.slice(start, end).every((bits) => bits & bit);
  for (let i = start; i < end; i++) points[i] = remove ? points[i] & ~bit : points[i] | bit;
  return spans(points);
}
export function formatted(marks: readonly Mark[], length: number, flag: Flag): boolean {
  const bit = 1 << FLAGS.indexOf(flag);
  return length > 0 && coverage(marks, length).every((bits) => bits & bit);
}
export function formattedRange(marks: readonly Mark[], length: number, start: number, end: number, flag: Flag): boolean {
  start = Math.max(0, start); end = Math.min(length, end);
  const bit = 1 << FLAGS.indexOf(flag);
  return end > start && coverage(marks, length).slice(start, end).every((bits) => bits & bit);
}
export function codePointOffset(text: string, unit: number): number {
  return Array.from(text.slice(0, unit)).length;
}
export function segments(text: string, marks: readonly Mark[]): ({ text: string } & Pick<Mark, Flag>)[] {
  const chars = Array.from(text), points = coverage(marks, chars.length);
  const result: ({ text: string } & Pick<Mark, Flag>)[] = [];
  for (let start = 0; start < chars.length;) {
    let end = start + 1;
    while (end < chars.length && points[end] === points[start]) end++;
    result.push({ text: chars.slice(start, end).join(""), ...flags(points[start]) });
    start = end;
  }
  return result;
}
export function remap(marks: readonly Mark[], before: string, after: string): Mark[] {
  if (!marks.length) return [];
  const old = Array.from(before), next = Array.from(after), points = coverage(marks, old.length);
  if (before === after) return spans(points);
  let start = 0, end = 0;
  while (start < old.length && start < next.length && old[start] === next[start]) start++;
  while (end < old.length - start && end < next.length - start &&
    old[old.length - 1 - end] === next[next.length - 1 - end]) end++;
  const inserted = Array<number>(next.length - start - end).fill(points[Math.max(0, start - 1)] ?? 0);
  return spans([...points.slice(0, start), ...inserted, ...points.slice(old.length - end)]);
}
