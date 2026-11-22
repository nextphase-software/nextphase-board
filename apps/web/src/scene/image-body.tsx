// SPDX-License-Identifier: Apache-2.0
import { Group, Image, Rect, Text } from "react-konva";
import type { ImageItem, BoardV12 } from "nextphase-board-rules/document.ts";
import { isImage } from "nextphase-board-rules/objects/registry.ts";
export function ImageBody({ object: o, bitmap, selected, zoom, loading }: { object: ImageItem; bitmap?: ImageBitmap; loading?: boolean; selected: boolean; zoom: number }) {
  const available = bitmap?.width === o.pixelWidth && bitmap?.height === o.pixelHeight;
  return <Group>
    {available ? <Image x={o.x} y={o.y} width={o.width} height={o.height} image={bitmap} /> : <>
      <Rect x={o.x} y={o.y} width={o.width} height={o.height} fill={loading ? "#f1eff4" : "#dedede"} />
      {loading ? <Group clipX={o.x} clipY={o.y} clipWidth={o.width} clipHeight={o.height}>
        <Text x={o.x + o.width / 2} y={o.y + o.height / 2} ref={text => { if (text) text.offset({ x: text.width() / 2, y: text.height() / 2 }); }}
          text="Loading image…" wrap="none" fontFamily="system-ui" fontSize={13} lineHeight={1} fill="#57535d" />
      </Group> : <Text x={o.x} y={o.y} width={o.width} height={o.height} text="Image unavailable" align="center" verticalAlign="middle" fontFamily="system-ui" fontSize={14} fill="#5f5b66" />}
    </>}
    {selected && <Rect x={o.x} y={o.y} width={o.width} height={o.height} stroke="#518de0" strokeWidth={2 / zoom} />}
  </Group>;
}
export function ImageNames({ board }: { board: BoardV12 }) {
  return <>{board.objects.filter(isImage).map((o) => <span key={o.id} className="sr-only" role="img" aria-label={o.description || "No description"} />)}</>;
}
