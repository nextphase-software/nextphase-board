// SPDX-License-Identifier: Apache-2.0
import { sticky } from "./sticky.ts";
import { section } from "./section.ts";
import { text } from "./text.ts";
import { shape, SHAPE_KINDS, type ShapeKeys, type ShapePaint } from "./shape.ts";
export * from "./shape.ts";
import { connector, type EndsKeys } from "./connector.ts";
export * from "./connector.ts";
import { stroke, type StrokeKeys } from "./stroke.ts";
export * from "./stroke.ts";
export type Rectangle = { x: number; y: number; width: number; height: number };

export type ObjectType = typeof sticky | typeof shape | typeof text | typeof section | typeof connector | typeof stroke;
export type TextRectangleType = Exclude<ObjectType, typeof connector | typeof stroke>["type"];
export type RectangleType = TextRectangleType | typeof stroke.type;
export type PointsType = typeof stroke.type;
export type EndsType = typeof connector.type;
export const OBJECT_TYPES: readonly ObjectType[] = [sticky, shape, text, section, stroke, connector];

export function objectType<T extends string>(type: T): Extract<ObjectType, { type: T }>;
export function objectType(type: string): ObjectType {
  const record = OBJECT_TYPES.find((t) => t.type === type);
  if (!record) throw new Error("Unknown object type: " + type);
  return record;
}

export function typeForTool(tool: string): TextRectangleType {
  const record = placementTool(tool);
  if (!record) throw new Error("Unknown object tool: " + tool);
  return record.type;
}

export function placementTool(tool: string): Exclude<ObjectType, typeof connector | typeof stroke> | undefined {
  return OBJECT_TYPES.find((t): t is Exclude<ObjectType, typeof connector | typeof stroke> => t.tool !== null && (t.tool === tool || t.kinds.some((k) => k.tool === tool)));
}

export function containerType(): typeof section {
  return OBJECT_TYPES.find((t): t is typeof section => t.container)!;
}

export function isContainer(object: { type: string }): boolean {
  return objectType(object.type).container;
}

export function hasEnds<T extends { type: string }>(o: T): o is T & EndsKeys & { type: typeof connector.type } {
  return objectType(o.type).ends;
}
export function hasRectangle<T extends { type: string }>(o: T): o is T & Rectangle & { type: RectangleType } {
  return !hasEnds(o);
}
export function hasPoints<T extends { type: string }>(o: T): o is T & StrokeKeys & Rectangle & { type: PointsType } { return objectType(o.type).points; }
export function hasText<T extends { type: string }>(o: T): o is T & { type: Exclude<ObjectType, typeof stroke>["type"] } { return objectType(o.type).text; }
export const sectionIdea = <T extends { type: string }>(o: T): o is T & Rectangle & { type: RectangleType } => hasRectangle(o) && !isContainer(o);
export const eligibleIdea = <T extends { type: string }>(o: T): o is T & Rectangle & { type: TextRectangleType } => sectionIdea(o) && !hasPoints(o);
export const typeWithPoints = () => stroke;
export const orderBand = (o: { type: string }) => isContainer(o) ? 0 : hasEnds(o) ? 1 : 2;
export const typeWithEnds = () => OBJECT_TYPES.find((t): t is typeof connector => t.ends)!;
export const rectangleType = <T extends RectangleType>(type: T) => objectType(type);
export const usesShapePaint = (object: { type: string }) => objectType(object.type).shapePaint;
export const kindForTool = (tool: string) => SHAPE_KINDS.find((k) => k.tool === tool)?.kind;
export const toolForKey = (key: string) => SHAPE_KINDS.find((k) => k.key.toLowerCase() === key.toLowerCase())?.tool;
export const kindInfo = (o: Partial<ShapeKeys & StrokeKeys>) => SHAPE_KINDS.find((k) => k.kind === o.shape)!;
export const labelPrefix = (o: { type: string } & Partial<ShapeKeys & StrokeKeys>) => objectType(o.type).labelPrefix(o);
export const textBox = (o: { type: string; x: number; y: number; width: number; height: number } & Partial<ShapeKeys & StrokeKeys>) => { const t = objectType(o.type); return t.text && !t.ends ? t.textBox(o) : o; };
export const fontSize = (o: { type: string; textSize: Parameters<typeof sticky.fontSize>[0]["textSize"] }) => { const t = objectType(o.type); return t.text ? t.fontSize(o) : 0; };
export function extraValues<T extends { type: string } & Partial<ShapeKeys & EndsKeys & StrokeKeys>>(o: T): Partial<T> {
  return Object.fromEntries(objectType(o.type).extraKeys.map((key) => {
    const value = o[key as keyof (ShapeKeys & EndsKeys & StrokeKeys)];
    // Nested paint is canonical too, independent of the incoming property order.
    return [key, key === "fill" ? { mode: o.fill!.mode, color: o.fill!.color }
      : key === "border" ? { style: o.border!.style, color: o.border!.color } : key === "from" || key === "to" ? { object: o[key]!.object, anchor: o[key]!.anchor } : key === "points" ? o.points!.map(([x, y]) => [x, y]) : value];
  })) as Partial<T>;
}
export function objectKeys(type: string, version: number): string[] {
  if (objectType(type).points) return [...stroke.savedKeys];
  return ["id", "generation", "type", "text", ...(version >= 2 ? ["color", "textSize", "align"] : []),
    ...(version >= 3 ? ["group"] : []), ...(version >= 4 ? ["marks"] : []),
    ...(version >= 5 ? ["section"] : []), ...(version >= 6 ? objectType(type).extraKeys : []),
    ...(objectType(type).ends ? [] : ["x", "y", "width", "height"]), "order"];
}
export const ADD_OPTIONS = OBJECT_TYPES.filter((t): t is Exclude<ObjectType, typeof connector | typeof stroke> => t.tool !== null).sort((a, b) => (Number(a.container) * 2 + Number(a.shapePaint)) - (Number(b.container) * 2 + Number(b.shapePaint))).flatMap((t) => t.kinds.length
  ? t.kinds.map((k) => ({ type: t.type, tool: k.tool, label: k.kind }))
  : [{ type: t.type, tool: t.tool, label: t.type }]);

export function creationValues<T extends { type: string }>(o: T, tool: string, paint: ShapePaint): T {
  return usesShapePaint(o) ? { ...o, shape: kindForTool(tool) ?? SHAPE_KINDS[0].kind, fill: { ...paint.fill }, border: { ...paint.border } } : o;
}
