// SPDX-License-Identifier: Apache-2.0
import type Konva from "konva";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { DrawExport } from "../board-export";
import { BoardDrawing } from "./board-drawing";

export const drawExport: DrawExport<Parameters<typeof BoardDrawing>[0]["objectLayouts"]> =
  ({ board, only, objectLayouts, bitmaps, box, fit }) => {
    const host = document.createElement("div");
    const stageRef: { current: Konva.Stage | null } = { current: null };
    try {
      const root = createRoot(host);
      try {
        flushSync(() => root.render(
          <BoardDrawing board={board} only={only} objectLayouts={objectLayouts} bitmaps={bitmaps} pixelScale={fit.scale}
            stageRef={stageRef} selected={new Set()} inline={false} faded={new Set()}
            tableGesture={{ ghost: null }} preview={null} movingIds={[]}
            size={{ w: 2, h: 2 }} view={{ x: box.x + 1, y: box.y + 1, z: 1 }} />,
        ));
        if (!stageRef.current) throw Error("Export stage did not mount synchronously.");
        return stageRef.current.toCanvas({
          x: 0, y: 0, width: fit.pixels.width / fit.scale, height: fit.pixels.height / fit.scale, pixelRatio: fit.scale,
        });
      } finally {
        root.unmount();
      }
    } finally {
      host.remove();
    }
  };
