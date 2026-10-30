// SPDX-License-Identifier: Apache-2.0
import type { RectangleItem, StrokeItem, ImageItem } from "nextphase-board-rules/document.ts";
import type { Corner, Rectangle } from "./resize";
import type { View } from "./view";

export type ResizeStart = { object: RectangleItem | StrokeItem | ImageItem; rectangle: Rectangle };
import type { ConnectionDrag } from "./connection-drag.ts";

export type Drag = {
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
