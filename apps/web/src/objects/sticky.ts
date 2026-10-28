// SPDX-License-Identifier: Apache-2.0
import { colorEntry, textUnits, type Style } from "../styles.ts";

const STICKY_TEXT = "#28272c";

export const sticky = {
  type: "sticky",
  label: "Sticky",
  tool: "Sticky",
  validFrom: 1,
  body: "note",
  points: false, text: true, ends: false, container: false,
  richText: true,
  textLimit: 1000,
  initialText: "",
  sizeRange: { min: 40, max: 2000 },
  extraKeys: [] as readonly string[],
  defaults: () => ({}),
  validExtras: (_o: object) => true,
  kinds: [] as readonly { kind: string; tool: string; key: string; round: boolean }[],
  shapePaint: false,
  growsWithText: true,
  previewRadius: 0,
  editorMinimum: { width: 120, height: 60 },
  textBox: (o: { x: number; y: number; width: number; height: number }) => ({
    x: o.x + 20, y: o.y + 20, width: o.width - 40, height: o.height - 40,
  }),
  fontSize: (o: Pick<Style, "textSize">) => textUnits(o.textSize),
  labelPrefix: (_o: object) => "sticky",
  draws: false,
  defaultSize: { width: 240, height: 240 },
  defaultStyle: { color: "rose", textSize: "medium", align: "left" },
  legacyStyle: { color: "rose", textSize: "medium", align: "left" },
  fill: (o: Pick<Style, "color">) => colorEntry(o.color).fill,
  edge: (o: Pick<Style, "color">) => colorEntry(o.color).edge,
  textColor: (_o: Pick<Style, "color">) => STICKY_TEXT,
} as const;
