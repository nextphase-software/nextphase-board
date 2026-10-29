// SPDX-License-Identifier: Apache-2.0
import { Group, Image, Rect, Text } from "react-konva";
import type { ImageItem, BoardV10 } from "../document.ts";
import { isImage } from "../objects/registry.ts";
export function ImageBody({ object: o, bitmap, selected, zoom }: { object: ImageItem; bitmap?: ImageBitmap; selected: boolean; zoom: number }) {
  const available = bitmap?.width === o.pixelWidth && bitmap?.height === o.pixelHeight;
  return <Group>
    {available ? <Image x={o.x} y={o.y} width={o.width} height={o.height} image={bitmap} /> : <>
      <Rect x={o.x} y={o.y} width={o.width} height={o.height} fill="#dedede" />
      <Text x={o.x} y={o.y} width={o.width} height={o.height} text="Image unavailable" align="center" verticalAlign="middle" fontFamily="system-ui" fontSize={14} fill="#5f5b66" />
    </>}
    {selected && <Rect x={o.x} y={o.y} width={o.width} height={o.height} stroke="#518de0" strokeWidth={2 / zoom} />}
  </Group>;
}
export function ImageNames({ board }: { board: BoardV10 }) {
  return <>{board.objects.filter(isImage).map((o) => <span key={o.id} className="sr-only" role="img" aria-label={o.description || "No description"} />)}</>;
}
