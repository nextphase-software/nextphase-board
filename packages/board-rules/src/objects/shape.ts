// SPDX-License-Identifier: Apache-2.0
import { textUnits, type Style } from "../styles.ts";

type FractionPoint = readonly [number, number];
type Outline = 'round' | 'rounded' | readonly FractionPoint[];
const starOutline: readonly FractionPoint[] = Array.from({ length: 10 }, (_, i) => {
  const angle = -Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? .2 : .5;
  return [.5 + Math.cos(angle) * radius, .54 + Math.sin(angle) * radius];
});
const kind = <K extends string, T extends string>(value: K, name: T, outline: Outline, textBox: readonly [number, number, number, number] | null, key: string | null = null, validFrom = 12) =>
  ({ kind: value, name, tool: name, key, validFrom, outline, textBox, round: outline === 'round' });
export const SHAPE_KINDS = [
  kind('square', 'Square', 'rounded', null, 'R', 6),
  kind('circle', 'Circle', 'round', null, 'O', 6),
  kind('rounded-rectangle', 'Rounded rectangle', 'rounded', null),
  kind('diamond', 'Diamond', [[.5,0],[1,.5],[.5,1],[0,.5]], [.25,.75,.25,.75]),
  kind('triangle', 'Triangle', [[.5,0],[1,1],[0,1]], [.25,.75,.45,.92]),
  kind('inverted-triangle', 'Inverted triangle', [[0,0],[1,0],[.5,1]], [.25,.75,.08,.55]),
  kind('pentagon', 'Pentagon', [[.5,0],[1,.38],[.81,1],[.19,1],[0,.38]], [.18,.82,.32,.92]),
  kind('octagon', 'Octagon', [[.29,0],[.71,0],[1,.29],[1,.71],[.71,1],[.29,1],[0,.71],[0,.29]], [.14,.86,.14,.86]),
  kind('star', 'Star', starOutline, [.32,.68,.38,.72]),
  kind('cross', 'Cross', [[.33,0],[.67,0],[.67,.33],[1,.33],[1,.67],[.67,.67],[.67,1],[.33,1],[.33,.67],[0,.67],[0,.33],[.33,.33]], [.06,.94,.35,.65]),
  kind('arrow-left', 'Left arrow', [[0,.5],[.4,0],[.4,.28],[1,.28],[1,.72],[.4,.72],[.4,1]], [.40,.96,.30,.70]),
  kind('arrow-right', 'Right arrow', [[1,.5],[.6,0],[.6,.28],[0,.28],[0,.72],[.6,.72],[.6,1]], [.04,.60,.30,.70]),
  kind('chevron', 'Chevron', [[0,0],[.7,0],[1,.5],[.7,1],[0,1],[.3,.5]], [.32,.72,.10,.90]),
  kind('speech-bubble', 'Speech bubble', [[0,0],[1,0],[1,.78],[.4,.78],[.2,1],[.2,.78],[0,.78]], [.05,.95,.06,.74]),
] as const;
export const SHAPE_COLORS = [
  ["black", "#1e1e1e"], ["dark-gray", "#6b6b6b"], ["red", "#e5483b"],
  ["orange", "#f5953b"], ["yellow", "#f7c744"], ["green", "#5cc96b"],
  ["teal", "#4fcdc4"], ["blue", "#3d9cf5"], ["violet", "#8b5cf6"],
  ["pink", "#ec4fae"], ["white", "#ffffff"], ["gray", "#b3b3b3"],
  ["light-gray", "#dedede"], ["light-red", "#fbcfca"], ["light-orange", "#fde0c5"],
  ["light-yellow", "#fdf0c4"], ["light-green", "#d3f2d4"], ["light-teal", "#ccf3ef"],
  ["light-blue", "#cfe5fb"], ["light-violet", "#e2d8fb"], ["light-pink", "#fbd4ec"],
].map(([name, value]) => ({ name, value, label: name[0].toUpperCase() + name.slice(1).replaceAll("-", " ") }));
export const FILL_MODES = [{ value: "fill", label: "Fill" }, { value: "transparent", label: "Transparent" }, { value: "none", label: "No fill" }] as const;
export const BORDER_STYLES = [{ value: "solid", label: "Solid" }, { value: "dashed", label: "Dashed" }, { value: "none", label: "None" }] as const;
export type ShapeKeys = {
  shape: typeof SHAPE_KINDS[number]["kind"];
  fill: { mode: typeof FILL_MODES[number]["value"]; color: string };
  border: { style: typeof BORDER_STYLES[number]["value"]; color: string };
};
export type ShapePaint = Pick<ShapeKeys, "fill" | "border">;
type Paintable = Partial<ShapeKeys>;
type Box = { x: number; y: number; width: number; height: number };
type Ink = { bold?: true; italic?: true; strike?: true };
type Piece = { text: string; style: Ink; x: number; width: number };
type Line = { width: number; pieces: Piece[] };
type Measure = (text: string, style: Ink) => number;
export const defaultPaint = (): ShapePaint => ({ fill: { mode: "fill", color: "white" }, border: { style: "solid", color: "dark-gray" } });
export const paintOf = (o: Paintable): ShapePaint => ({ fill: { ...o.fill! }, border: { ...o.border! } });
export const shapeColor = (color: string) => SHAPE_COLORS.find((c) => c.name === color)?.value ?? color;
export const shapeColorLabel = (color: string) => SHAPE_COLORS.find((c) => c.name === color)?.label ?? color;
export const validShapeColor = (value: unknown): value is string => typeof value === "string" &&
  (SHAPE_COLORS.some((c) => c.name === value) || /^#[0-9a-f]{6}$/.test(value));
export function darkened(color: string): string {
  return "#" + shapeColor(color).slice(1).match(/../g)!.map((c) => Math.round(parseInt(c, 16) * .75).toString(16).padStart(2, "0")).join("");
}
export function shapeTextColor(o: Paintable): string {
  if (o.fill?.mode !== "fill") return "#2c2c2c";
  const channels = shapeColor(o.fill.color).slice(1).match(/../g)!.map((c) => parseInt(c, 16) / 255)
    .map((s) => s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4);
  return channels.reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0) < .4 ? "#ffffff" : "#2c2c2c";
}
const exact = (value: unknown, keys: string[]) => !!value && typeof value === "object" &&
  Object.keys(value).sort().join() === [...keys].sort().join();
export function validShape(o: object, version = 12): boolean {
  const s = o as Paintable & { color: string };
  return s.color === "neutral" && SHAPE_KINDS.some((k) => k.kind === s.shape && k.validFrom <= version) &&
    exact(s.fill, ["mode", "color"]) && FILL_MODES.some((m) => m.value === s.fill!.mode) && validShapeColor(s.fill!.color) &&
    exact(s.border, ["style", "color"]) && BORDER_STYLES.some((b) => b.value === s.border!.style) && validShapeColor(s.border!.color);
}
export function shapeTextBox(o: Box & Paintable): Box {
  const info = SHAPE_KINDS.find((k) => k.kind === o.shape), round = info?.round;
  if (info?.textBox) {
    const [left, right, top, bottom] = info.textBox;
    return { x: o.x + o.width * left, y: o.y + o.height * top, width: o.width * (right-left), height: o.height * (bottom-top) };
  }
  const ix = round ? o.width * (1 - 1 / Math.SQRT2) / 2 + 6 : 16;
  const iy = round ? o.height * (1 - 1 / Math.SQRT2) / 2 + 4 : 12;
  return { x: o.x + ix, y: o.y + iy, width: Math.max(0, o.width - 2 * ix), height: Math.max(0, o.height - 2 * iy) };
}
// Callers supply the shared text layout, so object records depend only on styles.
export function shapeTextLayout(o: Box & Paintable & Pick<Style, "textSize"> & { text: string }, layout: (width: number) => Line[], measure: Measure) {
  const box = shapeTextBox(o), lineHeight = textUnits(o.textSize) * 1.45;
  const lines = layout(box.width);
  // The shared layout cannot place a grapheme wider than its box. Detect that
  // case rather than interpreting an empty/partial layout as text that fits.
  const complete = layout(Number.MAX_SAFE_INTEGER).every((line) => line.pieces.every((p) =>
    Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(p.text), (s) => s.segment)
      .every((g) => measure(g, p.style) <= box.width)));
  const fits = complete && Math.max(1, lines.length) * lineHeight <= box.height;
  const visible = Math.max(0, Math.floor(box.height / lineHeight));
  let drawn = complete ? lines.slice(0, visible) : [];
  if (!fits && drawn.length) {
    const last = drawn.at(-1)!;
    const tokens = last.pieces.flatMap((p) => Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(p.text), (s) => ({ text: s.segment, style: p.style })));
    const build = (): Line => {
      const pieces: Piece[] = [];
      const style = tokens.at(-1)?.style ?? {};
      for (const token of [...tokens, { text: "…", style }]) {
        const prev = pieces.at(-1);
        if (prev && JSON.stringify(prev.style) === JSON.stringify(token.style)) prev.text += token.text;
        else pieces.push({ ...token, x: 0, width: 0 });
      }
      let width = 0;
      for (const p of pieces) { p.x = width; p.width = measure(p.text, p.style); width += p.width; }
      return { width, pieces };
    };
    let ellipsis = build();
    while (tokens.length && ellipsis.width > box.width) { tokens.pop(); ellipsis = build(); }
    drawn = ellipsis.width <= box.width ? [...drawn.slice(0, -1), ellipsis] : [];
  }
  return { box, fits, lines: drawn, lineHeight };
}
export function fitHeight(o: Box & Paintable & Pick<Style, "textSize"> & { text: string }, layout: (width: number) => Line[], measure: Measure): number {
  const max = Math.min(2000, 1e6 - o.y), box = shapeTextBox(o);
  const lines = layout(box.width), lineHeight = textUnits(o.textSize) * 1.45;
  const info = SHAPE_KINDS.find((k) => k.kind === o.shape), round = info?.round;
  const needed = Math.max(1, lines.length) * lineHeight;
  let height = Math.min(max, Math.max(40, info?.textBox ? Math.ceil(needed / (info.textBox[3] - info.textBox[2])) : round ? (needed + 8) * Math.SQRT2 : needed + 24));
  // Keep the fitting endpoint when floating arithmetic subtracts the insets.
  if (height < max && !shapeTextLayout({ ...o, height }, layout, measure).fits) {
    height = Math.min(max, height + (info?.textBox ? 1 : Number.EPSILON * Math.max(1, height)));
  }
  return shapeTextLayout({ ...o, height: max }, layout, measure).fits ? height : max;
}
export const canGrow = (single: boolean, shapePaint: boolean, fits: boolean, height: number, fit: number, reason = "") =>
  single && shapePaint && !fits && fit > height && !reason;
export function changeKind<T extends Paintable>(o: T, kind: ShapeKeys["shape"]): T { return o.shape === kind ? o : { ...o, shape: kind }; }
export function changeFill<T extends Paintable>(o: T, change: Partial<ShapeKeys["fill"]>): T {
  const next = { ...o, fill: { ...o.fill!, ...change }, border: change.color === undefined ? o.border : { ...o.border!, color: darkened(change.color) } };
  return JSON.stringify(next) === JSON.stringify(o) ? o : next;
}
export function changeBorder<T extends Paintable>(o: T, change: Partial<ShapeKeys["border"]>): T {
  const next = { ...o, border: { ...o.border!, ...change } };
  return JSON.stringify(next) === JSON.stringify(o) ? o : next;
}
export function commonShapeValue<T>(objects: readonly Paintable[], get: (o: Paintable) => T): T | "" {
  const first = objects[0] && get(objects[0]);
  return first !== undefined && objects.every((o) => get(o) === first) ? first : "";
}
// Whole-object history is unchanged. Only paint-changing steps with two live
// endpoints update session paint; create/delete/duplicate never qualify.
export function paintAfterStep(step: { changes: { before: object | null; after: object | null }[] } | undefined, undo: boolean): ShapePaint | undefined {
  const changed = step?.changes.map((c) => ({ before: c.before as Paintable | null, after: c.after as Paintable | null })).filter(({ before, after }) => before?.fill && after?.fill &&
    JSON.stringify(paintOf(before)) !== JSON.stringify(paintOf(after)));
  const last = changed?.at(-1);
  return last ? paintOf((undo ? last.before : last.after)!) : undefined;
}
export const shape = {
  voting: true,
  type: "shape", label: "Shapes", tool: "Shapes", validFrom: 6, body: "shape-body",
  points: false, text: true, ends: false, container: false, richText: true, textLimit: 1000, initialText: "", draws: true,
  sizeRange: { min: 40, max: 2000 }, defaultSize: { width: 180, height: 180 },
  defaultStyle: { color: "neutral", textSize: "small", align: "center" },
  legacyStyle: { color: "neutral", textSize: "small", align: "center" },
  extraKeys: ["shape", "fill", "border"] as readonly string[],
  defaults: (): ShapeKeys => ({ shape: SHAPE_KINDS[0].kind, ...defaultPaint() }),
  validExtras: validShape, kinds: SHAPE_KINDS, shapePaint: true, growsWithText: false,
  previewRadius: 6, editorMinimum: { width: 40, height: 24 }, textBox: shapeTextBox,
  fontSize: (o: Pick<Style, "textSize">) => textUnits(o.textSize),
  labelPrefix: (o: Paintable) => SHAPE_KINDS.find(k => k.kind === o.shape)!.name.toLowerCase(),
  fill: (o: Paintable) => o.fill?.mode === "none" ? undefined : shapeColor(o.fill!.color),
  edge: (o: Paintable) => o.border?.style === "none" ? undefined : shapeColor(o.border!.color),
  textColor: shapeTextColor,
} as const;
