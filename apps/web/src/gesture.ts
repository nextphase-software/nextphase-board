// SPDX-License-Identifier: Apache-2.0
import type { ItemV3 as Item } from "./document";
import type { Corner, Rectangle } from "./resize";
import type { View } from "./view";

export type ResizeStart = { object: Item; rectangle: Rectangle };
export type Drag = {
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
