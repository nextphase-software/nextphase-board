// SPDX-License-Identifier: Apache-2.0
import type { Style } from "../styles.ts";

export const text = {
  type: "text",
  label: "Text",
  tool: "Text",
  fill: (_o: Pick<Style, "color">) => undefined,
  edge: (_o: Pick<Style, "color">) => undefined,
} as const;
