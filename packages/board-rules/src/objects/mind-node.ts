// SPDX-License-Identifier: Apache-2.0
import { colorEntry, textUnits, type Style } from "../styles.ts";

export const MIND_NODE_SIDES = ["left", "right"] as const;
export type MindNodeKeys = { parent: string | null; side: typeof MIND_NODE_SIDES[number] | null; rank: number; collapsed: boolean };
const LINE_BREAK = /[\n\r\u2028\u2029]/;
const fixedStyle = { color: "neutral", textSize: "medium", align: "left" } as const;

// Only the node's own values are checked here; parents, sides and loops are
// structure, which the document owns.
export function validMindNode(value: object): boolean {
  const o = value as MindNodeKeys & { text: unknown; textSize: unknown; align: unknown; group: unknown; section: unknown; marks: unknown };
  return typeof o.text === "string" && !LINE_BREAK.test(o.text) && o.textSize === fixedStyle.textSize &&
    o.align === fixedStyle.align && o.group === null && o.section === null && Array.isArray(o.marks) && o.marks.length === 0 &&
    (o.parent === null || typeof o.parent === "string") && (o.side === null || MIND_NODE_SIDES.includes(o.side)) &&
    Number.isSafeInteger(o.rank) && o.rank >= 0 && o.rank <= 9999 && typeof o.collapsed === "boolean";
}

export const mindNode = {
  voting: false,
  type: "mindNode",
  label: "Mind map node",
  tool: "Mind map",
  validFrom: 11,
  body: "mind-node-body",
  points: false, text: true, ends: false, container: false,
  richText: false,
  textLimit: 200,
  initialText: "",
  sizeRange: { min: 1, max: 20000 },
  extraKeys: ["parent", "side", "rank", "collapsed"] as readonly string[],
  defaults: (): MindNodeKeys => ({ parent: null, side: null, rank: 0, collapsed: false }),
  validExtras: validMindNode,
  kinds: [] as readonly { kind: string; tool: string; key: string; round: boolean }[],
  shapePaint: false,
  // The map's layout owns the box; text never grows it on its own.
  growsWithText: false,
  previewRadius: 0,
  editorMinimum: { width: 0, height: 0 },
  textBox: (o: { x: number; y: number; width: number; height: number }) => ({
    x: o.x + 8, y: o.y + 6, width: o.width - 16, height: o.height - 12,
  }),
  // The look follows the role: a root uses Large, any other node Medium.
  fontSize: (o: { parent?: string | null }) => textUnits(o.parent == null ? "large" : "medium"),
  labelPrefix: (_o: object) => "mind map node",
  draws: false,
  defaultSize: { width: 120, height: 39 },
  defaultStyle: fixedStyle,
  legacyStyle: fixedStyle,
  fill: (_o: Pick<Style, "color">) => undefined,
  edge: (_o: Pick<Style, "color">) => undefined,
  textColor: (o: Pick<Style, "color">) => colorEntry(o.color).text,
} as const;
