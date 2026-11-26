// SPDX-License-Identifier: Apache-2.0
import { normalize, type Mark } from "./marks.ts";

export function linkAddress(raw: string): { ok: true; href: string } | { ok: false } {
  let text = raw.trim();
  if (!text || text.length > 2048 || /[\s\p{Cc}]/u.test(text)) return { ok: false };
  if (!/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(text) && text.split(/[/?#]/, 1)[0].includes(".")) {
    text = "https://" + text;
  }
  try {
    const url = new URL(text);
    if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname &&
        !url.username && !url.password && url.href.length <= 2048) return { ok: true, href: url.href };
  } catch { /* A relative or malformed address has no absolute URL. */ }
  return { ok: false };
}

const clamp = (offset: number, length: number) => Math.max(0, Math.min(length, offset));

export function linkAt(marks: readonly Mark[], length: number, start: number, end: number): { start: number; end: number; href: string } | null {
  start = clamp(start, length);
  end = clamp(end, length);
  if (start > end || start === end && (start === 0 || end === length)) return null;
  const from = start === end ? start - 1 : start;
  const through = start === end ? end + 1 : end;
  const first = marks.findIndex(mark => mark.start <= from && mark.end > from);
  if (first < 0 || !marks[first].link) return null;
  const href = marks[first].link!;
  let left = first, right = first;
  while (left > 0 && marks[left - 1].end === marks[left].start && marks[left - 1].link === href) left--;
  while (right + 1 < marks.length && marks[right].end === marks[right + 1].start && marks[right + 1].link === href) right++;
  const stop = clamp(marks[right].end, length);
  return stop < through ? null : { start: clamp(marks[left].start, length), end: stop, href };
}

export function touchesLink(marks: readonly Mark[], length: number, start: number, end: number): boolean {
  start = clamp(start, length);
  end = clamp(end, length);
  if (start > end) return false;
  const from = start === end ? Math.max(0, start - 1) : start;
  const through = start === end ? Math.min(length, end + 1) : end;
  return through > from && marks.some(mark => !!mark.link && mark.start < through && mark.end > from);
}

export function setLink(marks: readonly Mark[], text: string, start: number, end: number, href: string | null): Mark[] {
  const length = Array.from(text).length;
  start = clamp(start, length);
  end = clamp(end, length);
  if (start >= end) return [...marks];
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    let offset = 0;
    for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)) {
      const next = offset + Array.from(segment).length;
      if (offset < start && start < next) start = offset;
      if (offset < end && end < next) end = next;
      if (next >= end) break;
      offset = next;
    }
  }
  const changed: Mark[] = [];
  for (const mark of marks) {
    if (mark.start >= end || mark.end <= start) {
      changed.push(mark);
      continue;
    }
    if (mark.start < start) changed.push({ ...mark, end: start });
    const { link: _link, ...flags } = mark;
    changed.push({ ...flags, start: Math.max(start, mark.start), end: Math.min(end, mark.end) });
    if (mark.end > end) changed.push({ ...mark, start: end });
  }
  if (href !== null) changed.push({ start, end, link: href });
  return normalize(changed, length);
}
