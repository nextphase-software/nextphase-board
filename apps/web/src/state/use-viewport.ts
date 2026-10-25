// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState, type RefObject } from "react";
import type { ItemV3 as Item } from "../document";
import type { Corner, Rectangle } from "../resize";
import { gestureScale, panView, wheelDelta, wheelZoomFactor, zoomView, type View } from "../view";

type ResizeStart = { object: Item; rectangle: Rectangle };
type Input = {
  scene: RefObject<HTMLDivElement | null>;
  inlineSurface: RefObject<HTMLElement | null>;
  inline: boolean;
  drag: RefObject<
    {
      id: string;
      ids?: string[];
      previous?: string[];
      box?: boolean;
      additive?: boolean;
      corner?: Corner;
      resizeStart?: ResizeStart[];
      crossed?: boolean;
      x: number;
      y: number;
      cx: number;
      cy: number;
      view: View;
      pan: boolean;
      temporary?: boolean;
      pointerId?: number;
      cancelled?: boolean;
    } | null
  >;
  pending: RefObject<{ invalid: boolean; composing: boolean; busy: boolean }>;
};

export function useViewport({ scene, inlineSurface, inline, drag, pending }: Input) {
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 1 });
  const lastPointer = useRef<{ x: number; y: number } | null>(null),
    previousScale = useRef(1);
  useEffect(() => {
    const canvas = scene.current!;
    // The native editor is a sibling overlay, so it needs the same scene rules.
    // Floating controls and panels are outside both listener targets.
    const surfaces = [canvas, inlineSurface.current].filter((el) => el !== null);
    const dimensions = () => ({ w: canvas.clientWidth, h: canvas.clientHeight });
    const wheel = (event: WheelEvent) => {
      const zoom = event.ctrlKey || event.metaKey;
      if (!zoom && event.target instanceof Element && event.target.closest(".inline")) return;
      event.preventDefault();
      if (drag.current || pending.current.composing) return;
      const size = dimensions();
      const delta = wheelDelta(event.deltaX, event.deltaY, event.deltaMode, size,
        !zoom && event.shiftKey);
      if (zoom) {
        const rect = canvas.getBoundingClientRect();
        const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        setView((v) => zoomView(v, wheelZoomFactor(delta.y), point, size));
      } else setView((v) => panView(v, delta));
    };
    const gesture = (event: Event) => {
      event.preventDefault();
      const type = event.type as "gesturestart" | "gesturechange" | "gestureend";
      const next = gestureScale(previousScale.current, type, (event as Event & { scale?: number }).scale);
      previousScale.current = next.previous;
      // Consume scale even while blocked so the next delta cannot jump.
      if (type !== "gesturechange" || drag.current || pending.current.composing || next.factor === 1) return;
      const size = dimensions();
      const point = lastPointer.current ?? { x: size.w / 2, y: size.h / 2 };
      setView((v) => zoomView(v, next.factor, point, size));
    };
    const gestures = ["gesturestart", "gesturechange", "gestureend"];
    for (const surface of surfaces) {
      surface.addEventListener("wheel", wheel, { passive: false });
      for (const name of gestures) surface.addEventListener(name, gesture, { passive: false });
    }
    return () => {
      for (const surface of surfaces) {
        surface.removeEventListener("wheel", wheel);
        for (const name of gestures) surface.removeEventListener(name, gesture);
      }
    };
  }, [inline]);
  function trackPointer(e: React.PointerEvent) {
    const r = scene.current!.getBoundingClientRect();
    lastPointer.current = { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  return { view, setView, trackPointer };
}
