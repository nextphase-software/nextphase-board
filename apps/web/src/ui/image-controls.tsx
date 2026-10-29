// SPDX-License-Identifier: Apache-2.0
import type { RefObject } from "react";
import type { ImageItem } from "../document.ts";
import { count } from "../document.ts";
export type ImagePicker = { disabled: boolean; mac: boolean; choose: () => void };
export type DescriptionControl = {
  image: ImageItem | undefined; value: string; opened: boolean; disabled: boolean;
  field: RefObject<HTMLTextAreaElement | null>; button: RefObject<HTMLButtonElement | null>; control: RefObject<HTMLSpanElement | null>;
  toggle: () => void; change: (value: string) => void; commit: () => void; close: () => void;
  focusField: (node: HTMLTextAreaElement | null) => void;
  startComposition: () => void; endComposition: (value: string) => void;
};
export function ImageButton({ picker }: { picker: ImagePicker }) {
  const tooltip = picker.mac ? "Image ⇧⌘K" : "Image Ctrl+Shift+K";
  return <button className="icon-button" aria-label="Image" title={tooltip} disabled={picker.disabled} onClick={picker.choose}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 3-5 6 7" />
    </svg><span className="tooltip">{tooltip}</span>
  </button>;
}
export function DescriptionField({ control: c, panel = false }: { control: DescriptionControl; panel?: boolean }) {
  const id = panel ? "image-description-panel" : "image-description-objects";
  return <>
    <label htmlFor={id}>Description</label>
    <textarea id={id} aria-label="Description" rows={3} className="image-description-field"
      ref={panel ? c.focusField : c.field} value={c.value} readOnly={c.disabled}
      onChange={(e) => c.change(e.target.value)} onBlur={c.commit}
      onCompositionStart={c.startComposition} onCompositionEnd={(e) => c.endComposition(e.currentTarget.value)} />
    <small>{count(c.value)} / 1,000{panel ? "" : " code points"}</small>
  </>;
}
export function ImageControls({ count, control: c }: { count: number; control: DescriptionControl }) {
  if (!count) return null;
  return <>
    <span>{count === 1 ? "Image" : count + " images"}</span>
    {count === 1 && <><span className="divider" aria-hidden="true" />
      <span className="image-description-control" ref={c.control} onKeyDown={(e) => {
        if (e.key === "Escape" && !e.nativeEvent.isComposing) { e.preventDefault(); e.stopPropagation(); c.close(); }
      }}>
        <button ref={c.button} disabled={c.disabled} aria-expanded={c.opened} onClick={c.toggle}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg>Description
        </button>
        {c.opened && <div className="image-description-panel" role="group" aria-label="Description"><DescriptionField control={c} panel /></div>}
      </span>
    </>}
  </>;
}
