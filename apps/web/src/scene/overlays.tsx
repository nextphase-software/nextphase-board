// SPDX-License-Identifier: Apache-2.0
import { placementTool } from "nextphase-board-rules/objects/registry.ts";
import type { Corner, Rectangle } from "../resize";
import { boundingBox, type DisplayObject } from "../selection";
import type { View } from "../view";

type Props = {
  selectedGroups: Map<string, DisplayObject[]>;
  pos: (o: { x: number; y: number }) => { left: number; top: number };
  view: View;
  handlesVisible: boolean;
  handlePoints: { corner: Corner; x: number; y: number }[];
  spacePan: boolean;
  tool: string;
  selectionBox: Rectangle | null;
};

export function Overlays({ selectedGroups, pos, view, handlesVisible, handlePoints, spacePan, selectionBox, tool }: Props) {
  const previewRadius = placementTool(tool)?.previewRadius ?? 0;
  return (
    <>
      {[...selectedGroups].filter(([, members]) => members.length >= 2).map(([id, members]) => {
        const box = boundingBox(members)!;
        return <svg key={id} className="group-outline" aria-hidden="true"
          style={{ left: pos(box).left, top: pos(box).top }}
          width={box.width * view.z} height={box.height * view.z}>
          <rect width={box.width * view.z} height={box.height * view.z} />
        </svg>;
      })}
      {handlesVisible && handlePoints.map((h) => <div key={h.corner}
        className={"resize-handle " + h.corner} aria-hidden="true"
        style={{ left: pos(h).left, top: pos(h).top,
          cursor: spacePan ? "grab" : undefined }} />)}
      {selectionBox && <div className={"selection-box" + (placementTool(tool)?.draws ? " drawing" : "")} aria-hidden="true" style={{
        left: pos(selectionBox).left, top: pos(selectionBox).top,
        ...(previewRadius ? { borderRadius: previewRadius * view.z } : {}),
        width: selectionBox.width * view.z, height: selectionBox.height * view.z,
      }} />}
    </>
  );
}
