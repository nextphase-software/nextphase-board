// SPDX-License-Identifier: Apache-2.0
import type { ItemV12 } from "nextphase-board-rules/document.ts";
import { isImage } from "nextphase-board-rules/objects/registry.ts";

export function GifMarks({ objects, animated, bitmaps, selected, hovered, pos, zoom }: {
  objects: readonly ItemV12[]; animated: ReadonlySet<string>; bitmaps: ReadonlyMap<string, ImageBitmap>;
  selected: ReadonlySet<string>; hovered: string; pos: (point: { x: number; y: number }) => { left: number; top: number }; zoom: number;
}) {
  return <>{objects.filter(isImage).flatMap(image => {
    const bitmap = bitmaps.get(image.asset);
    if (selected.has(image.id) || !animated.has(image.asset) || bitmap?.width !== image.pixelWidth || bitmap.height !== image.pixelHeight) return [];
    const width = image.width * zoom, height = image.height * zoom, { left, top } = pos(image);
    if (width < 40 || height < 28) return [];
    return [<div key={image.id} className="gif-badge" aria-hidden="true" style={{ left: left + width - 6, top: top + 6 }}>GIF</div>,
      hovered === image.id && width >= 56 && height >= 56 && <div key={image.id + "-play"} className="gif-play" aria-hidden="true" style={{ left: left + width / 2 - 20, top: top + height / 2 - 20 }} />];
  })}</>;
}
