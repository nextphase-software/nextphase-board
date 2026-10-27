// SPDX-License-Identifier: Apache-2.0
import type { PointerEventHandler, ReactNode, RefObject } from "react";
import type { ItemV6 as Item } from "../document";
import { TEXT_INSET, TEXT_LAYOUT } from "../geometry";
import { objectType, textBox } from "../objects/registry";
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
  const box = textBox({ ...item, height: itemHeight });
  return (
    <section
      ref={inlineSurface}
      className={"inline" + (richText ? objectType(item.type).shapePaint ? " shape-editor" : "" : " name-field")}
      onPointerEnter={trackPointer}
      onPointerDown={trackPointer}
      onPointerMove={trackPointer}
      style={{
        left: pos(richText ? box : item).left + (richText ? 0 : 2) * view.z,
        top: pos(richText ? box : item).top + (richText ? 0 : -34) * view.z,
        width: (richText ? box.width : Math.min(item.width, 200)) * view.z,
        height: (richText ? box.height : 28) * view.z,
        fontFamily: TEXT_LAYOUT.fontFamily,
        fontSize: (richText ? textUnits(item.textSize) : 18) * view.z,
        textAlign: item.align,
        color: objectType(item.type).textColor(item),
      }}
    >
      {objectType(item.type).shapePaint && !item.text && <span className="shape-placeholder" aria-hidden="true">Add text</span>}
      {nativeEditor}
    </section>
  );
}
