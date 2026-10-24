// SPDX-License-Identifier: Apache-2.0
import { colorEntry, type Style } from "../styles.ts";

export const sticky = {
  type: "sticky",
  label: "Sticky",
  tool: "Sticky",
  fill: (o: Pick<Style, "color">) => colorEntry(o.color).fill,
  edge: (o: Pick<Style, "color">) => colorEntry(o.color).edge,
} as const;
