// SPDX-License-Identifier: Apache-2.0
import type { RectangleItem, StrokeItem, ImageItem } from "nextphase-board-rules/document.ts";
import type { Corner, Rectangle } from "./resize";
import type { View } from "./view";

export type ResizeStart = { object: RectangleItem | StrokeItem | ImageItem; rectangle: Rectangle };
import type { ConnectionDrag } from "./connection-drag.ts";

// One mind node pressed and dragged: its branch, the drop target under the
// pointer and, on a root, the side the pointer is on.
export type MapDrag = { node: string; branch: string[]; root: boolean; target: string | null; side: "left" | "right" };
// A mind-node drag: no drop moves whole maps; a preview draws the drag; a drop
// releases one node over a target or elsewhere.
export type NodeDrop = { preview: true } | { preview?: false; target: string | null; side: "left" | "right" };
export type Drag = {
  mapDrag?: MapDrag;
  drawing?: { positions: { x: number; y: number }[]; tool: string };
  connection?: ConnectionDrag;
  id: string;
  ids?: string[];
  previous?: string[];
  box?: boolean;
  additive?: boolean;
  corner?: Corner;
  resizeStart?: ResizeStart[];
  crossed?: boolean;
  x: number;
  y: number;
  cx: number;
  cy: number;
  view: View;
  pan: boolean;
  temporary?: boolean;
  pointerId?: number;
  cancelled?: boolean;
};
