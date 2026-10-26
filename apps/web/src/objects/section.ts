// SPDX-License-Identifier: Apache-2.0
import { colorEntry, type Style } from "../styles.ts";

export const section = {
  type: "section",
  label: "Section",
  tool: "Section",
  validFrom: 5,
  body: "section",
  container: true,
  richText: false,
  textLimit: 100,
  initialText: "Section",
  sizeRange: { min: 200, max: 10000 },
  draws: true,
  defaultSize: { width: 640, height: 480 },
  defaultStyle: { color: "neutral", textSize: "medium", align: "left" },
  legacyStyle: { color: "neutral", textSize: "medium", align: "left" },
  fill: (o: Pick<Style, "color">) => colorEntry(o.color).fill,
  edge: (o: Pick<Style, "color">) => colorEntry(o.color).edge,
  textColor: (_o: Pick<Style, "color">) => "#5f5b66",
} as const;
