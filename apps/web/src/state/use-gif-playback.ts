// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState } from "react";
import type { ItemV12 } from "nextphase-board-rules/document.ts";
import { decodeGif } from "../gif.ts";
import { tabPictures } from "../image-assets.ts";

type Frame = { bitmap: ImageBitmap; delay: number };
let cache: { asset: string; frames: Frame[] } | undefined;
const warned = new Set<string>();

export function useGifPlayback({ objects, selected, animated, bitmaps, pressedPlay, setMessage }: {
  objects: readonly ItemV12[]; selected: ReadonlySet<string>; animated: ReadonlySet<string>;
  bitmaps: ReadonlyMap<string, ImageBitmap>; pressedPlay?: { id: string; sequence: number }; setMessage: (text: string) => void;
}) {
  const item = selected.size === 1 ? objects.find(o => selected.has(o.id)) : undefined;
  const candidate = item && "asset" in item && animated.has(item.asset) && bitmaps.get(item.asset)?.width === item.pixelWidth &&
    bitmaps.get(item.asset)?.height === item.pixelHeight ? item : undefined;
  const latch = useRef({ id: "", sequence: 0 });
  if (latch.current.id !== candidate?.id) latch.current.id = "";
  if (pressedPlay && latch.current.sequence !== pressedPlay.sequence) {
    latch.current = { sequence: pressedPlay.sequence, id: pressedPlay.id === candidate?.id ? pressedPlay.id : "" };
  }
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const target = !reduced || latch.current.id === candidate?.id ? candidate : undefined;
  const id = target?.id, asset = target?.asset;
  const [frame, setFrame] = useState<{ id: string; asset: string; bitmap: ImageBitmap }>();
  useEffect(() => {
    if (!id || !asset) return;
    let cancelled = false, timer: ReturnType<typeof setTimeout>;
    async function start(id: string, asset: string) {
      let frames = cache?.asset === asset ? cache.frames : undefined;
      if (!frames) {
        const picture = tabPictures.get(asset);
        if (!picture) return;
        const built: Frame[] = [];
        try {
          const gif = decodeGif(picture.bytes, 16_000_000);
          for (const { rgba, delay } of gif.frames) {
            const bitmap = await createImageBitmap(new ImageData(rgba, gif.width, gif.height));
            built.push({ bitmap, delay });
            if (cancelled) return;
          }
          cache?.frames.forEach(f => f.bitmap.close());
          cache = { asset, frames: built }; frames = built;
        } catch (error) {
          if (!cancelled && error instanceof Error && error.message === "gif_too_large" && !warned.has(asset)) {
            warned.add(asset); setMessage("This GIF is too large to play.");
          }
          return;
        } finally { if (cache?.frames !== built) built.forEach(f => f.bitmap.close()); }
      }
      const loop = frames;
      function show(index: number) {
        if (cancelled) return;
        setFrame({ id, asset, bitmap: loop[index].bitmap });
        timer = setTimeout(() => show((index + 1) % loop.length), loop[index].delay);
      }
      show(0);
    }
    void start(id, asset);
    return () => { cancelled = true; clearTimeout(timer); setFrame(undefined); };
  }, [id, asset]);
  return { playing: frame && frame.id === id && frame.asset === asset ? { id: frame.id, bitmap: frame.bitmap } : undefined };
}
