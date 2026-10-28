// SPDX-License-Identifier: Apache-2.0
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { Drag } from "../gesture";
import { defaultDrawingStyle, isDrawingTool, inkForTool, INK_KINDS, type InkWeight } from "../objects/registry";

export function useGestureState(clearSelection: () => void, finishTextSession: () => void, closeEditor: () => void) {
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null),
    [tool, assignTool] = useState("Select"), [lastDrawingTool, setLastDrawingTool] = useState<string>(INK_KINDS[0].tool),
    [drawingStyle, setDrawingStyle] = useState(defaultDrawingStyle),
    [busy, setBusy] = useState(false),
    [spacePan, setSpacePan] = useState(false);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const scene = useRef<HTMLDivElement>(null),
    spacePanRef = useRef(false),
    drag = useRef<Drag | null>(null);
  const setTool: Dispatch<SetStateAction<string>> = (value) => {
    const next = typeof value === "function" ? value(toolRef.current) : value;
    if (isDrawingTool(next)) {
      finishTextSession(); clearSelection(); closeEditor(); setLastDrawingTool(next);
    }
    toolRef.current = next; assignTool(next);
  };
  function selectionStarted() { if (isDrawingTool(toolRef.current)) { toolRef.current = "Select"; assignTool("Select"); } }
  function changeDrawingStyle(change: { color?: string; weight?: InkWeight }) {
    const kind = inkForTool(tool)?.kind;
    if (kind) setDrawingStyle((style) => ({ ...style, [kind]: { ...style[kind], ...change } }));
  }
  const drawing = { lastDrawingTool, style: drawingStyle, change: changeDrawingStyle };
  return {
    selectionBox, setSelectionBox, tool, setTool, busy, setBusy, spacePan, setSpacePan,
    scene, spacePanRef, drag, drawing, selectionStarted,
  };
}
