// SPDX-License-Identifier: Apache-2.0
import type { ItemV10 } from "nextphase-board-rules/document.ts";
import type { Rectangle } from "nextphase-board-rules/objects/registry.ts";
import type { ConnectorLayout } from "./connectors.ts";
export type ResolvedItem = ItemV10 & Rectangle & { displayHeight: number; connectorLayout?: ConnectorLayout };
export const TEXT_INSET = 20;
export const TEXT_LAYOUT = {
  fontFamily: "system-ui",
  fontSize: 18,
  lineHeight: 1.45,
  wrap: "word",
} as const;

type HeightBounds = { y: number; height: number };

export function allowedHeight(y: number): number {
  return Math.min(2000, 1000000 - y);
}

export function neededHeight(lineCount: number, fontSize: number = TEXT_LAYOUT.fontSize): number {
  return Math.ceil(Math.max(1, lineCount) * fontSize * TEXT_LAYOUT.lineHeight) +
    2 * TEXT_INSET;
}

export function savedHeight(object: HeightBounds, lineCount: number, fontSize: number = TEXT_LAYOUT.fontSize): number {
  return Math.min(allowedHeight(object.y), Math.max(object.height, neededHeight(lineCount, fontSize)));
}

// The same bound applies to a browser's display-only extra height. Neither
// calculation mutates saved geometry; only a committed text edit adopts it.
export function displayHeight(object: HeightBounds, lineCount: number, fontSize: number = TEXT_LAYOUT.fontSize): number {
  return savedHeight(object, lineCount, fontSize);
}
