// SPDX-License-Identifier: Apache-2.0
import { validShapeColor, shapeColor } from "./shape.ts";
export const END_SIDES = ["auto", "top", "right", "bottom", "left"] as const;
export type End = { object: string; anchor: typeof END_SIDES[number] };
export const HEADS = ["none", "line-arrow", "solid-arrow", "triangle", "circle", "diamond"] as const;
export const HEAD_LABELS = ["None", "Line arrow", "Solid arrow", "Triangle", "Circle", "Diamond"] as const;
export const LINE_SHAPES = ["elbowed", "curved", "straight"] as const;
export const LINE_SHAPE_LABELS = ["Elbowed", "Curved", "Straight"] as const;
export type ConnectorStyle = { lineColor: string; lineWeight: "thin" | "thick"; lineDash: "solid" | "dashed";
  startHead: typeof HEADS[number]; endHead: typeof HEADS[number]; lineShape: typeof LINE_SHAPES[number] };
export const CONNECTOR_STYLE_KEYS = ["lineColor", "lineWeight", "lineDash", "startHead", "endHead", "lineShape"] as const;
export const defaultConnectorStyle = (): ConnectorStyle => ({ lineColor: "dark-gray", lineWeight: "thin", lineDash: "solid",
  startHead: "none", endHead: "line-arrow", lineShape: "elbowed" });
export const connectorStyleOf = (o: ConnectorStyle): ConnectorStyle => Object.fromEntries(CONNECTOR_STYLE_KEYS.map((key) => [key, o[key]])) as ConnectorStyle;
export const lineWidth = (o: Pick<ConnectorStyle, "lineWeight">) => o.lineWeight === "thick" ? 7 : 3.5;
export const lineDash = (o: Pick<ConnectorStyle, "lineWeight" | "lineDash">) => o.lineDash === "dashed" ? [5 * lineWidth(o), 3 * lineWidth(o)] : [];
export const validConnectorStyle = (o: ConnectorStyle) => validShapeColor(o.lineColor) && ["thin", "thick"].includes(o.lineWeight) &&
  ["solid", "dashed"].includes(o.lineDash) && HEADS.includes(o.startHead) && HEADS.includes(o.endHead) && LINE_SHAPES.includes(o.lineShape);
export type EndsKeys = { from: End; to: End };
const fixedStyle = { color: "neutral", textSize: "medium", align: "center" } as const;
function validEnd(value: unknown, version: number): boolean {
  const end = value as End;
  return !!end && typeof end === "object" && Object.keys(end).sort().join() === "anchor,object" &&
    typeof end.object === "string" && (version >= 9 ? END_SIDES.includes(end.anchor) : end.anchor === "auto");
}
export const connector = {
  type: "connector", label: "Connector", tool: null, validFrom: 7, body: "connector-body",
  points: false, text: true, ends: true, container: false, richText: false, textLimit: 100, initialText: "",
  draws: false, kinds: [] as readonly { kind: string; tool: string; key: string; round: boolean }[],
  shapePaint: false, growsWithText: false, previewRadius: 0,
  defaultStyle: fixedStyle, legacyStyle: fixedStyle,
  extraKeys: ["from", "to", ...CONNECTOR_STYLE_KEYS] as readonly string[], defaults: () => ({}),
  validExtras: (value: object, version = 9) => {
    const o = value as EndsKeys & typeof fixedStyle & { group: unknown; section: unknown; marks: unknown[] };
    return validEnd(o.from, version) && validEnd(o.to, version) && (version < 9 || validConnectorStyle(o as unknown as ConnectorStyle)) && o.color === fixedStyle.color &&
      o.textSize === fixedStyle.textSize && o.align === fixedStyle.align &&
      o.group === null && o.section === null && Array.isArray(o.marks) && o.marks.length === 0;
  },
  fontSize: (_o: object) => 18, labelPrefix: (_o: object) => "connector",
  fill: (_o: object) => undefined, edge: (o: object) => shapeColor((o as ConnectorStyle).lineColor ?? "dark-gray"),
  textColor: (_o: object) => "#2c2c2c",
} as const;
