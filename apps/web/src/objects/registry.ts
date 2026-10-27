// SPDX-License-Identifier: Apache-2.0
import { sticky } from "./sticky.ts";
import { section } from "./section.ts";
import { text } from "./text.ts";
import { shape, SHAPE_KINDS, type ShapeKeys, type ShapePaint } from "./shape.ts";
export * from "./shape.ts";

export type ObjectType = typeof sticky | typeof shape | typeof text | typeof section;
export const OBJECT_TYPES: readonly ObjectType[] = [sticky, shape, text, section];

export function objectType(type: string): ObjectType {
  const record = OBJECT_TYPES.find((t) => t.type === type);
  if (!record) throw new Error("Unknown object type: " + type);
  return record;
}

export function typeForTool(tool: string): ObjectType["type"] {
  const record = placementTool(tool);
  if (!record) throw new Error("Unknown object tool: " + tool);
  return record.type;
}

export function placementTool(tool: string): ObjectType | undefined {
  return OBJECT_TYPES.find((t) => t.tool === tool || t.kinds.some((k) => k.tool === tool));
}

export function containerType(): ObjectType {
  return OBJECT_TYPES.find((t) => t.container)!;
}

export function isContainer(object: { type: string }): boolean {
  return objectType(object.type).container;
}

export const usesShapePaint = (object: { type: string }) => objectType(object.type).shapePaint;
export const kindForTool = (tool: string) => SHAPE_KINDS.find((k) => k.tool === tool)?.kind;
export const toolForKey = (key: string) => SHAPE_KINDS.find((k) => k.key.toLowerCase() === key.toLowerCase())?.tool;
export const kindInfo = (o: Partial<ShapeKeys>) => SHAPE_KINDS.find((k) => k.kind === o.shape)!;
export const labelPrefix = (o: { type: string } & Partial<ShapeKeys>) => objectType(o.type).labelPrefix(o);
export const textBox = (o: { type: string; x: number; y: number; width: number; height: number } & Partial<ShapeKeys>) => objectType(o.type).textBox(o);
export const fontSize = (o: { type: string; textSize: Parameters<typeof sticky.fontSize>[0]["textSize"] }) => objectType(o.type).fontSize(o);
export function extraValues(o: { type: string } & Partial<ShapeKeys>): Partial<ShapeKeys> {
  return Object.fromEntries(objectType(o.type).extraKeys.map((key) => {
    const value = o[key as keyof ShapeKeys];
    // Nested paint is canonical too, independent of the incoming property order.
    return [key, key === "fill" ? { mode: o.fill!.mode, color: o.fill!.color }
      : key === "border" ? { style: o.border!.style, color: o.border!.color } : value];
  }));
}
export function objectKeys(type: string, version: number): string[] {
  return ["id", "generation", "type", "text", ...(version >= 2 ? ["color", "textSize", "align"] : []),
    ...(version >= 3 ? ["group"] : []), ...(version >= 4 ? ["marks"] : []),
    ...(version >= 5 ? ["section"] : []), ...(version >= 6 ? objectType(type).extraKeys : []),
    "x", "y", "width", "height", "order"];
}
export const ADD_OPTIONS = [...OBJECT_TYPES].sort((a, b) => (Number(a.container) * 2 + Number(a.shapePaint)) - (Number(b.container) * 2 + Number(b.shapePaint))).flatMap((t) => t.kinds.length
  ? t.kinds.map((k) => ({ type: t.type, tool: k.tool, label: k.kind }))
  : [{ type: t.type, tool: t.tool, label: t.type }]);

export function creationValues<T extends { type: string }>(o: T, tool: string, paint: ShapePaint): T {
  return usesShapePaint(o) ? { ...o, shape: kindForTool(tool) ?? SHAPE_KINDS[0].kind, fill: { ...paint.fill }, border: { ...paint.border } } : o;
}
