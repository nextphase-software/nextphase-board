// SPDX-License-Identifier: Apache-2.0
import { clamp, type ItemV5 as Item } from "./document.ts";
import { isContainer } from "./objects/registry.ts";
import type { Rectangle } from "./resize.ts";
import type { View } from "./view.ts";

export type ContextBarPositionInput = {
  bounds: Rectangle | null;
  pos: (o: { x: number; y: number }) => { left: number; top: number };
  view: View;
  size: { w: number; h: number };
  contextWidth: number;
  layout: { notice: number; panel: number };
  inline: boolean;
  item: Item | undefined;
  itemHeight: number;
};

export function contextBarPosition({
  bounds, pos, view, size, contextWidth, layout, inline, item, itemHeight,
}: ContextBarPositionInput) {
  const contextLeft = bounds
    ? clamp(pos(bounds).left + bounds.width * view.z / 2 - contextWidth / 2,
      12, Math.max(12, size.w - contextWidth - 12)) : 12;
  const contextAbove = bounds ? pos(bounds).top - 48 - (item && isContainer(item) ? 30 * view.z : 0) : 0;
  const contextBelow = bounds ? pos(bounds).top + bounds.height * view.z + 8 : 0;
  const contextTop = clamp(contextAbove >= layout.panel ? contextAbove : contextBelow,
    layout.panel, Math.max(layout.panel, size.h - 52));
  const nameField = item && isContainer(item) ? {
    left: pos(item).left + 2 * view.z, top: pos(item).top - 34 * view.z,
    width: Math.min(item.width, 200) * view.z, height: 28 * view.z,
  } : null;
  const overlapsEditor = inline && item && (nameField
    ? contextTop < nameField.top + nameField.height && contextTop + 40 > nameField.top &&
      contextLeft < nameField.left + nameField.width && contextLeft + contextWidth > nameField.left
    : contextTop < pos(item).top + (itemHeight - 20) * view.z &&
      contextTop + 40 > pos(item).top + 20 * view.z &&
      contextLeft < pos(item).left + (item.width - 20) * view.z &&
      contextLeft + contextWidth > pos(item).left + 20 * view.z);
  const contextFits = size.w >= 768 && contextWidth > 0 && contextWidth <= size.w - 24 &&
    contextTop + 40 <= size.h - 12 && !overlapsEditor;
  return { contextLeft, contextTop, contextFits };
}
