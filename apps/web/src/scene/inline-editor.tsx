// SPDX-License-Identifier: Apache-2.0
import type { PointerEventHandler, ReactNode, RefObject } from "react";
import type { ItemV4 as Item } from "../document";
import { TEXT_INSET, TEXT_LAYOUT } from "../geometry";
import { objectType } from "../objects/registry";
import { textUnits } from "../styles";
import type { View } from "../view";

type Props = {
  inlineSurface: RefObject<HTMLElement | null>;
  trackPointer: PointerEventHandler;
  pos: (o: { x: number; y: number }) => { left: number; top: number };
  item: Item;
  view: View;
  itemHeight: number;
  nativeEditor: ReactNode;
};

export function InlineEditor({ inlineSurface, trackPointer, pos, item, view, itemHeight, nativeEditor }: Props) {
  return (
    <section
      ref={inlineSurface}
      className="inline"
      onPointerEnter={trackPointer}
      onPointerDown={trackPointer}
      onPointerMove={trackPointer}
      style={{
        left: pos(item).left + TEXT_INSET * view.z,
        top: pos(item).top + TEXT_INSET * view.z,
        width: (item.width - 2 * TEXT_INSET) * view.z,
        height: (itemHeight - 2 * TEXT_INSET) * view.z,
        fontFamily: TEXT_LAYOUT.fontFamily,
        fontSize: textUnits(item.textSize) * view.z,
        textAlign: item.align,
        color: objectType(item.type).textColor(item),
      }}
    >
      {nativeEditor}
    </section>
  );
}
