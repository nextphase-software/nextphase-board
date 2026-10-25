// SPDX-License-Identifier: Apache-2.0
import { useRef, useState } from "react";
import type { Drag } from "../gesture";

export function useGestureState() {
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null),
    [tool, setTool] = useState("Select"),
    [busy, setBusy] = useState(false),
    [spacePan, setSpacePan] = useState(false);
  const scene = useRef<HTMLDivElement>(null),
    spacePanRef = useRef(false),
    drag = useRef<Drag | null>(null);
  return {
    selectionBox, setSelectionBox, tool, setTool, busy, setBusy, spacePan, setSpacePan,
    scene, spacePanRef, drag,
  };
}
