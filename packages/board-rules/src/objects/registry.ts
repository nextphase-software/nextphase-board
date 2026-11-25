// SPDX-License-Identifier: Apache-2.0
import { sticky } from "./sticky.ts";
import { section } from "./section.ts";
import { text } from "./text.ts";
import { shape, SHAPE_KINDS, type ShapeKeys, type ShapePaint } from "./shape.ts";
export * from "./shape.ts";
import { connector, type EndsKeys, type ConnectorStyle, CONNECTOR_STYLE_KEYS } from "./connector.ts";
export * from "./connector.ts";
import { stroke, type StrokeKeys } from "./stroke.ts";
export * from "./stroke.ts";
import { image, type ImageKeys } from "./image.ts";
export * from "./image.ts";
import { video, type VideoKeys } from "./video.ts";
export * from "./video.ts";
import { link, type LinkKeys } from "./link.ts";
export * from "./link.ts";
import { mindNode, type MindNodeKeys } from "./mind-node.ts";
export * from "./mind-node.ts";
import { tape, type TapeKeys } from "./tape.ts";
export * from "./tape.ts";
import { table, type TableKeys } from "./table.ts";
export * from "./table.ts";
export type Rectangle = { x: number; y: number; width: number; height: number };

export type ObjectType = typeof sticky | typeof shape | typeof text | typeof section | typeof connector | typeof stroke | typeof image | typeof video | typeof link | typeof mindNode | typeof tape | typeof table;
export type TextRectangleType = Exclude<ObjectType, typeof connector | typeof stroke | typeof image | typeof video | typeof link | typeof tape | typeof table>["type"];
export type RectangleType = TextRectangleType | typeof stroke.type | typeof image.type | typeof video.type | typeof link.type | typeof tape.type | typeof table.type;
export type PlacementType = TextRectangleType | typeof table.type;
export type PointsType = typeof stroke.type;
export type EndsType = typeof connector.type;
export const OBJECT_TYPES: readonly ObjectType[] = [sticky, shape, text, section, table, stroke, connector, image, video, link, mindNode, tape];

export function objectType<T extends string>(type: T): Extract<ObjectType, { type: T }>;
export function objectType(type: string): ObjectType {
  const record = OBJECT_TYPES.find((t) => t.type === type);
  if (!record) throw new Error("Unknown object type: " + type);
  return record;
}

export function typeForTool(tool: string): PlacementType {
  const record = placementTool(tool);
  if (!record) throw new Error("Unknown object tool: " + tool);
  return record.type;
}

export function placementTool(tool: string): Exclude<ObjectType, typeof connector | typeof stroke | typeof image | typeof video | typeof link | typeof tape> | undefined {
  return OBJECT_TYPES.find((t): t is Exclude<ObjectType, typeof connector | typeof stroke | typeof image | typeof video | typeof link | typeof tape> => t.tool !== null && (t.tool === tool || t.kinds.some((k) => k.tool === tool)));
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
export function hasText<T extends { type: string }>(o: T): o is T & { type: Exclude<ObjectType, typeof stroke | typeof image | typeof video | typeof link | typeof tape | typeof table>["type"] } { return objectType(o.type).text; }
export const sectionIdea = <T extends { type: string }>(o: T): o is T & Rectangle & { type: RectangleType } => hasRectangle(o) && !isContainer(o) && !isMindNode(o);
export const eligibleVote = (o: { type: string }) => objectType(o.type).voting;
export const voteTextAnchor = (o: { type: string }) => o.type === text.type;
export const eligibleIdea = <T extends { type: string }>(o: T): o is T & Rectangle & { type: TextRectangleType } => sectionIdea(o) && !hasPoints(o) && !isMedia(o) && !isLink(o) && !isTape(o) && !isTable(o);
export function isImage<T extends { type: string }>(o: T): o is T & ImageKeys & Rectangle & { type: typeof image.type } { return o.type === image.type; }
export function isVideo<T extends { type: string }>(o: T): o is T & VideoKeys & Rectangle & { type: typeof video.type } { return o.type === video.type; }
export function isLink<T extends { type: string }>(o: T): o is T & LinkKeys & Rectangle & { type: typeof link.type } { return o.type === link.type; }
export function isMedia<T extends { type: string }>(o: T) { return isImage(o) || isVideo(o); }
export function pictureOf(o: { type: string }): string | undefined { return isImage(o) ? o.asset : isVideo(o) ? o.poster : isLink(o) ? o.asset ?? undefined : undefined; }
export function assetsOf(o: { type: string }): string[] { return isVideo(o) ? [o.asset, o.poster] : isImage(o) ? [o.asset] : isLink(o) && o.asset !== null ? [o.asset] : []; }
export const linkType = () => link;
export const videoType = () => video;
export function isMindNode<T extends { type: string }>(o: T): o is T & MindNodeKeys & Rectangle & { type: typeof mindNode.type } { return o.type === mindNode.type; }
export function isTape<T extends { type: string }>(o: T): o is T & TapeKeys & Rectangle & { type: typeof tape.type } { return o.type === tape.type; }
export function isTable<T extends { type: string }>(o: T): o is T & TableKeys & Rectangle & { type: typeof table.type } { return o.type === table.type; }
export const tapeType = () => tape;
export const keepsProportions = (o: { type: string }) => hasPoints(o) || isMedia(o);
export const imageType = () => image;
export const typeWithPoints = () => stroke;
export const orderBand = (o: { type: string }) => isContainer(o) ? 0 : hasEnds(o) ? 1 : 2;
export const typeWithEnds = () => OBJECT_TYPES.find((t): t is typeof connector => t.ends)!;
export const rectangleType = <T extends RectangleType>(type: T) => objectType(type);
export const usesShapePaint = (object: { type: string }) => objectType(object.type).shapePaint;
export const kindForTool = (tool: string) => SHAPE_KINDS.find((k) => k.tool === tool)?.kind;
export const toolForKey = (key: string, shift = false) => shift && key.toLowerCase() === "t" ? table.tool : SHAPE_KINDS.find((k) => k.key?.toLowerCase() === key.toLowerCase())?.tool;
export const kindInfo = (o: Partial<ShapeKeys & StrokeKeys>) => SHAPE_KINDS.find((k) => k.kind === o.shape)!;
export const labelPrefix = (o: { type: string } & Partial<ShapeKeys & StrokeKeys>) => objectType(o.type).labelPrefix(o);
export const textBox = (o: { type: string; x: number; y: number; width: number; height: number } & Partial<ShapeKeys & StrokeKeys>) => { const t = objectType(o.type); return t.text && !t.ends ? t.textBox(o) : o; };
export const fontSize = (o: { type: string; textSize: Parameters<typeof sticky.fontSize>[0]["textSize"] }) => { const t = objectType(o.type); return t.text ? t.fontSize(o) : 0; };
export function extraValues<T extends { type: string } & Partial<ShapeKeys & EndsKeys & StrokeKeys & ConnectorStyle & Omit<VideoKeys, "asset"> & LinkKeys & TapeKeys>>(o: T): Partial<T> {
  return Object.fromEntries(objectType(o.type).extraKeys.map((key) => {
    const value = o[key as keyof (ShapeKeys & EndsKeys & StrokeKeys & ConnectorStyle & Omit<VideoKeys, "asset"> & LinkKeys & TapeKeys)];
    // Nested paint is canonical too, independent of the incoming property order.
    return [key, key === "fill" ? { mode: o.fill!.mode, color: o.fill!.color }
      : key === "border" ? { style: o.border!.style, color: o.border!.color } : key === "from" || key === "to" ? { object: o[key]!.object, anchor: o[key]!.anchor } : key === "points" ? o.points!.map(([x, y]) => [x, y]) : value];
  })) as Partial<T>;
}
export function objectKeys(type: string, version: number): string[] {
  const record = objectType(type);
  if ("savedKeys" in record) return record.savedKeys.filter((key) => version >= 13 || key !== "page");
  return ["id", "generation", "type", ...(version >= 13 ? ["page"] : []), "text", ...(version >= 2 ? ["color", "textSize", "align"] : []),
    ...(version >= 3 ? ["group"] : []), ...(version >= 4 ? ["marks"] : []),
    ...(version >= 5 ? ["section"] : []), ...(version >= 6 ? objectType(type).extraKeys.filter((key) => version >= 9 || !CONNECTOR_STYLE_KEYS.includes(key as keyof ConnectorStyle)) : []),
    ...(objectType(type).ends ? [] : ["x", "y", "width", "height"]), "order"];
}
export const ADD_OPTIONS = OBJECT_TYPES.filter((t): t is Exclude<ObjectType, typeof connector | typeof stroke | typeof image | typeof video | typeof link | typeof tape | typeof table> => t.tool !== null && !isMindNode(t) && !isTable(t)).sort((a, b) => (Number(a.container) * 2 + Number(a.shapePaint)) - (Number(b.container) * 2 + Number(b.shapePaint))).flatMap((t) => t.kinds.length
  ? t.kinds.filter(k => k.key).map((k) => ({ type: t.type, tool: k.tool, label: k.kind }))
  : [{ type: t.type, tool: t.tool, label: t.type }]);

export function creationValues<T extends { type: string }>(o: T, tool: string, paint: ShapePaint): T {
  return usesShapePaint(o) ? { ...o, shape: kindForTool(tool) ?? SHAPE_KINDS[0].kind, fill: { ...paint.fill }, border: { ...paint.border } } : o;
}

// The type record supplies the outline kind; callers never compare type names.
export function outlinePoint(o: Rectangle & { displayHeight?: number; type?: string; shape?: ShapeKeys["shape"] }, toward: { x: number; y: number }) {
  const h = o.displayHeight ?? o.height, rx = o.width / 2, ry = h / 2;
  const centre = { x: o.x + rx, y: o.y + ry };
  let dx = toward.x - centre.x, dy = toward.y - centre.y;
  if (!dx && !dy) dx = 1;
  const length = Math.hypot(dx, dy), n = { x: dx / length, y: dy / length };
  if (!rx || !ry) return { point: centre, normal: n };
  const record = o.type ? objectType(o.type) : undefined, paint = record?.shapePaint;
  if (paint && kindInfo(o).round) {
    const t = 1 / Math.hypot(dx / rx, dy / ry), x = dx * t, y = dy * t;
    const norm = Math.hypot(x / (rx * rx), y / (ry * ry));
    return { point: { x: centre.x + x, y: centre.y + y }, normal: { x: x / (rx * rx) / norm, y: y / (ry * ry) / norm } };
  }
  if (paint && Array.isArray(kindInfo(o).outline)) {
    const vertices = (kindInfo(o).outline as readonly (readonly [number, number])[]).map(([x,y]) => ({ x:o.x+x*o.width, y:o.y+y*h }));
    const cross = (ax: number, ay: number, bx: number, by: number) => ax*by-ay*bx;
    const hits: {t:number; normal:{x:number;y:number}}[] = [];
    for (let i=0;i<vertices.length;i++) {
      const a=vertices[i],b=vertices[(i+1)%vertices.length],ex=b.x-a.x,ey=b.y-a.y;
      const den=cross(dx,dy,ex,ey);
      if(Math.abs(den)<1e-12) continue;
      const ax=a.x-centre.x,ay=a.y-centre.y,t=cross(ax,ay,ex,ey)/den,u=cross(ax,ay,dx,dy)/den;
      if(t>=0&&u>=-1e-9&&u<=1+1e-9) { const l=Math.hypot(ex,ey); hits.push({t,normal:{x:ey/l,y:-ex/l}}); }
    }
    if(hits.length) {
      const far=Math.max(...hits.map(h=>h.t)),edges=hits.filter(h=>Math.abs(h.t-far)*length<1e-7);
      const nx=edges.reduce((s,e)=>s+e.normal.x,0),ny=edges.reduce((s,e)=>s+e.normal.y,0),norm=Math.hypot(nx,ny);
      return {point:{x:centre.x+dx*far,y:centre.y+dy*far},normal:{x:nx/norm,y:ny/norm}};
    }
  }
  let t = Math.min(dx ? rx / Math.abs(dx) : Infinity, dy ? ry / Math.abs(dy) : Infinity);
  const radius = paint ? Math.min(o.shape === "rounded-rectangle" ? Math.min(o.width,h)*.18 : record!.previewRadius, rx, ry) : 0;
  const inside = (t: number) => Math.hypot(Math.max(0, Math.abs(dx * t) - rx + radius), Math.max(0, Math.abs(dy * t) - ry + radius)) <= radius;
  if (radius && !inside(t)) {
    let low = 0, high = t;
    for (let i = 0; i < 60; i++) { const mid = (low + high) / 2; if (inside(mid)) low = mid; else high = mid; }
    t = low;
  }
  const x = dx * t, y = dy * t;
  let nx = Math.sign(x) * Math.max(0, Math.abs(x) - rx + radius), ny = Math.sign(y) * Math.max(0, Math.abs(y) - ry + radius);
  if (!radius || !nx && !ny) { nx = Math.abs(Math.abs(x) - rx) < 1e-8 ? Math.sign(x) : 0; ny = Math.abs(Math.abs(y) - ry) < 1e-8 ? Math.sign(y) : 0; }
  const norm = Math.hypot(nx, ny);
  return { point: { x: centre.x + x, y: centre.y + y }, normal: { x: nx / norm, y: ny / norm } };
}
