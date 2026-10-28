// SPDX-License-Identifier: Apache-2.0
import type { PointerEventHandler, ReactNode, RefObject } from "react";
import type { ResolvedItem as Item } from "../document";
import { TEXT_INSET, TEXT_LAYOUT } from "../geometry";
import { objectType, textBox, hasText, hasEnds } from "../objects/registry";
import { labelEditorBox } from "../connectors";
import { textUnits } from "../styles";
import type { View } from "../view";

type Props = {
  inlineSurface: RefObject<HTMLElement | null>;
  trackPointer: PointerEventHandler;
  pos: (o: { x: number; y: number }) => { left: number; top: number };
  item: Item;
  view: View;
  itemHeight: number;
  text: string;
  nativeEditor: ReactNode;
};

export function InlineEditor({ inlineSurface, trackPointer, pos, item, view, itemHeight, text, nativeEditor }: Props) {
  if (!hasText(item)) return null;
  const richText = objectType(item.type).richText;
  const ends = hasEnds(item);
  const box = ends ? labelEditorBox(item.connectorLayout!.labelPoint, text) : textBox({ ...item, height: itemHeight });
  return (
    <section
      ref={inlineSurface}
      className={"inline" + (ends ? " connector-editor" : richText ? objectType(item.type).shapePaint ? " shape-editor" : "" : " name-field")}
      onPointerEnter={trackPointer}
      onPointerDown={trackPointer}
      onPointerMove={trackPointer}
      style={{
        left: pos(ends || richText ? box : item).left + (ends || richText ? 0 : 2) * view.z,
        top: pos(ends || richText ? box : item).top + (ends || richText ? 0 : -34) * view.z,
        width: (ends || richText ? box.width : Math.min(item.width, 200)) * view.z,
        height: (ends || richText ? box.height : 28) * view.z,
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
