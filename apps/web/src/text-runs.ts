// SPDX-License-Identifier: Apache-2.0
import { FLAGS, type Flag, type Mark } from "./marks.ts";

export type RunStyle = Pick<Mark, Flag>;
export type Piece = { text: string; style: RunStyle; x: number; width: number };
export type RunLine = { width: number; pieces: Piece[] };
export type Measure = (text: string, style: RunStyle) => number;
const segmenter = typeof Intl !== "undefined" && Intl.Segmenter
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
export function graphemes(text: string): string[] {
  return segmenter ? Array.from(segmenter.segment(text), (s) => s.segment)
    : text.match(/\p{RI}\p{RI}|\P{M}(?:\p{M}|\p{Emoji_Modifier}|\uFE0F|\u200D\P{M})*|\p{M}+/gu) ?? [];
}
export function layoutRuns(text: string, marks: readonly Mark[], maxWidth: number, measure: Measure): RunLine[] {
  const lines: RunLine[] = [];
  let offset = 0;
  for (const paragraph of text.split("\n")) {
    const tokens = graphemes(paragraph).map((text) => {
      const mark = marks.find((m) => m.start <= offset && offset < m.end);
      const style: RunStyle = {};
      for (const flag of FLAGS) if (mark?.[flag]) style[flag] = true;
      offset += Array.from(text).length;
      return { text, style };
    });
    offset++; // The paragraph separator also occupies one code point.
    const line = (start: number, end: number): RunLine => {
      const pieces: Piece[] = [];
      for (const token of tokens.slice(start, end)) {
        const last = pieces.at(-1);
        if (last && FLAGS.every((flag) => last.style[flag] === token.style[flag])) last.text += token.text;
        else pieces.push({ ...token, x: 0, width: 0 });
      }
      let width = 0;
      for (const piece of pieces) {
        piece.x = width;
        piece.width = measure(piece.text, piece.style);
        width += piece.width;
      }
      return { width, pieces };
    };
    const whole = line(0, tokens.length);
    if (whole.width <= maxWidth) { lines.push(whole); continue; }
    const isBreak = (i: number) => tokens[i]?.text === " " || tokens[i]?.text === "-";
    const perLine = Math.max(1, Math.ceil(tokens.length * maxWidth / whole.width));
    let start = 0;
    while (start < tokens.length) {
      let low = start, high = Math.min(tokens.length, start + perLine);
      while (line(start, high).width <= maxWidth) {
        low = high;
        if (high === tokens.length) break;
        high = Math.min(tokens.length, high + high - start);
      }
      while (high - low > 1) {
        const mid = (low + high) >>> 1;
        if (line(start, mid).width <= maxWidth) low = mid; else high = mid;
      }
      if (low === start) break;
      if (low === tokens.length) { lines.push(line(start, low)); break; }
      if (!isBreak(low)) {
        let wrap = low - 1;
        while (wrap >= start && !isBreak(wrap)) wrap--;
        if (wrap >= start) low = wrap + 1;
      }
      let trimmed = low;
      while (trimmed > start && !tokens[trimmed - 1].text.trim()) trimmed--;
      lines.push(line(start, trimmed));
      start = low;
      while (start < tokens.length && !tokens[start].text.trim()) start++;
    }
  }
  return lines;
}
export function lineOffset(align: "left" | "center" | "right", maxWidth: number, lineWidth: number): number {
  return align === "center" ? (maxWidth - lineWidth) / 2 : align === "right" ? maxWidth - lineWidth : 0;
}
