// SPDX-License-Identifier: Apache-2.0
import { colorEntry, type Style } from "../styles.ts";

const STICKY_TEXT = "#28272c";

export const sticky = {
  type: "sticky",
  label: "Sticky",
  tool: "Sticky",
  defaultSize: { width: 240, height: 240 },
  defaultStyle: { color: "rose", textSize: "medium", align: "left" },
  legacyStyle: { color: "rose", textSize: "medium", align: "left" },
  fill: (o: Pick<Style, "color">) => colorEntry(o.color).fill,
  edge: (o: Pick<Style, "color">) => colorEntry(o.color).edge,
  textColor: (_o: Pick<Style, "color">) => STICKY_TEXT,
} as const;
