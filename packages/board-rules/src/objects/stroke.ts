// SPDX-License-Identifier: Apache-2.0
export const INK_KINDS = [
  { kind: "marker", tool: "Marker", label: "Marker", prefix: "marker stroke", round: true, widths: [4, 10],
    colors: [["black", "#1e1e1e"], ["red", "#e5483b"], ["orange", "#f5953b"], ["yellow", "#f7c744"], ["green", "#5cc96b"], ["blue", "#3d9cf5"], ["violet", "#8b5cf6"], ["white", "#ffffff"]] },
  { kind: "highlighter", tool: "Highlighter", label: "Highlight", prefix: "highlight", round: false, widths: [22, 40],
    colors: [["grey", "#b3b3b3"], ["pink", "#f7a8d8"], ["orange", "#fdb46b"], ["yellow", "#fff04d"], ["green", "#a6ef6b"], ["cyan", "#7cf2ec"], ["violet", "#c6a6ff"], ["white", "#ffffff"]] },
] as const;
export const DRAWING_TOOLS = [...INK_KINDS.map((k) => k.tool), "Eraser"] as const;
export type DrawingTool = typeof DRAWING_TOOLS[number];
export type InkKind = typeof INK_KINDS[number]["kind"];
export const INK_WEIGHTS = ["thin", "thick"] as const;
export type InkWeight = typeof INK_WEIGHTS[number];
export type InkPoint = [number, number];
export type StrokeKeys = { kind: InkKind; color: string; weight: InkWeight; points: InkPoint[] };
export const inkInfo = (o: { kind?: InkKind }) => INK_KINDS.find((k) => k.kind === o.kind)!;
export const inkForTool = (tool: string) => INK_KINDS.find((k) => k.tool === tool);
export const isDrawingTool = (tool: string): tool is DrawingTool => DRAWING_TOOLS.some((t) => t === tool);
export const isEraser = (tool: string) => tool === "Eraser";
export const drawingKey = (key: string, shift: boolean) => key.toLowerCase() === "m" ? INK_KINDS[shift ? 1 : 0].tool
  : shift && (key === "Delete" || key === "Backspace") ? "Eraser" : undefined;
export const inkWidth = (o: Pick<StrokeKeys, "kind" | "weight">) => inkInfo(o).widths[o.weight === "thin" ? 0 : 1];
export const inkColors = (o: { kind?: InkKind }) => inkInfo(o).colors.map(([name, value]) => ({ name, value, label: name[0].toUpperCase() + name.slice(1) }));
export const inkColor = (o: Pick<StrokeKeys, "kind" | "color">) => inkColors(o).find((c) => c.name === o.color)!.value;
export const defaultDrawingStyle = () => ({
  marker: { kind: INK_KINDS[0].kind, color: "black", weight: "thin" as InkWeight },
  highlighter: { kind: INK_KINDS[1].kind, color: "yellow", weight: "thin" as InkWeight },
});
export type DrawingStyle = ReturnType<typeof defaultDrawingStyle>;
export const drawingStyleFor = (tool: string, style: DrawingStyle) => style[(inkForTool(tool) ?? INK_KINDS[0]).kind];
export function validStroke(value: object): boolean {
  const o = value as StrokeKeys & { width: number; height: number };
  if (!INK_KINDS.some((k) => k.kind === o.kind) || !INK_WEIGHTS.includes(o.weight) || !inkColors(o).some((c) => c.name === o.color) ||
    !Number.isSafeInteger(o.width) || !Number.isSafeInteger(o.height) || !Array.isArray(o.points) || o.points.length < 2 || o.points.length > 1000) return false;
  if (!o.points.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isSafeInteger) && p[0] >= 0 && p[0] <= o.width && p[1] >= 0 && p[1] <= o.height)) return false;
  const pad = inkWidth(o) / 2;
  return Math.min(...o.points.map((p) => p[0])) === pad && Math.min(...o.points.map((p) => p[1])) === pad &&
    Math.max(...o.points.map((p) => p[0])) + pad === o.width && Math.max(...o.points.map((p) => p[1])) + pad === o.height;
}
export const stroke = {
  type: "stroke", label: "Draw", tool: null, validFrom: 8, body: "stroke-body",
  points: true, text: false, ends: false, container: false, richText: false,
  extraKeys: ["kind", "color", "weight", "points"] as readonly string[],
  savedKeys: ["id", "generation", "type", "kind", "color", "weight", "group", "section", "x", "y", "width", "height", "points", "order"],
  validExtras: validStroke, sizeRange: { min: 4, max: 2000000 }, shapePaint: false,
  growsWithText: false, labelPrefix: (o: Partial<StrokeKeys>) => inkInfo(o).prefix,
  contextLabel: (o: Partial<StrokeKeys>) => inkInfo(o).label,
} as const;
