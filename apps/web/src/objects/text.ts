// SPDX-License-Identifier: Apache-2.0
import { colorEntry, type Style } from "../styles.ts";

export const text = {
  type: "text",
  label: "Text",
  tool: "Text",
  defaultSize: { width: 320, height: 120 },
  defaultStyle: { color: "neutral", textSize: "medium", align: "left" },
  legacyStyle: { color: "neutral", textSize: "medium", align: "left" },
  fill: (_o: Pick<Style, "color">) => undefined,
  edge: (_o: Pick<Style, "color">) => undefined,
  textColor: (o: Pick<Style, "color">) => colorEntry(o.color).text,
} as const;
