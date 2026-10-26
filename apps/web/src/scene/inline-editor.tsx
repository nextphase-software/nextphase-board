// SPDX-License-Identifier: Apache-2.0
import type { PointerEventHandler, ReactNode, RefObject } from "react";
import type { ItemV5 as Item } from "../document";
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
  const richText = objectType(item.type).richText;
  return (
    <section
      ref={inlineSurface}
      className={"inline" + (richText ? "" : " name-field")}
      onPointerEnter={trackPointer}
      onPointerDown={trackPointer}
      onPointerMove={trackPointer}
      style={{
        left: pos(item).left + (richText ? TEXT_INSET : 2) * view.z,
        top: pos(item).top + (richText ? TEXT_INSET : -34) * view.z,
        width: (richText ? item.width - 2 * TEXT_INSET : Math.min(item.width, 200)) * view.z,
        height: (richText ? itemHeight - 2 * TEXT_INSET : 28) * view.z,
        fontFamily: TEXT_LAYOUT.fontFamily,
        fontSize: (richText ? textUnits(item.textSize) : 18) * view.z,
        textAlign: item.align,
        color: objectType(item.type).textColor(item),
      }}
    >
      {nativeEditor}
    </section>
  );
}
