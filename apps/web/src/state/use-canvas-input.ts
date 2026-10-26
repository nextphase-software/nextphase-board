// SPDX-License-Identifier: Apache-2.0
import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import { add, clamp, type Board as SavedBoard, type BoardV5 as Board, type ItemV5 as Item } from "../document";
import { boxSelection } from "../selection";
import { expandSelection, pressSelection, toggleGroup } from "../group";
import type { Corner } from "../resize";
import type { View } from "../view";
import { typeForTool } from "../objects/registry";
import type { Drag, ResizeStart } from "../gesture";

type Input = {
  model: RefObject<Board>;
  commit: (input: SavedBoard, recordObject?: boolean, orderIds?: readonly string[]) => void;
  setBoard: Dispatch<SetStateAction<Board>>;
  clearHistory: () => void;
  finishTextSession: () => void;
  setView: Dispatch<SetStateAction<View>>;
  trackPointer: (e: React.PointerEvent) => void;
  setMessage: (value: string) => void;
  create: (type: Item["type"], x: number, y: number, native?: boolean) => void;
  resizeStart: () => ResizeStart[];
  resizeStillValid: (start: ResizeStart[]) => boolean;
  resizedBoard: (corner: Corner, start: ResizeStart[], dx: number, dy: number, shift: boolean) => Board;
  movedBoard: (ids: string[], dx: number, dy: number) => Board;
  scene: RefObject<HTMLDivElement | null>;
  view: View;
  size: { w: number; h: number };
  drag: RefObject<Drag | null>;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  spacePanRef: RefObject<boolean>;
  setSpacePan: Dispatch<SetStateAction<boolean>>;
  setSelectionBox: Dispatch<SetStateAction<{ x: number; y: number; width: number; height: number } | null>>;
  selected: Set<string>;
  select: (value: string | Iterable<string>) => void;
  tool: string;
  setTool: Dispatch<SetStateAction<string>>;
  readOnly: boolean;
  composing: boolean;
  inline: boolean;
  setInline: Dispatch<SetStateAction<boolean>>;
  setPanel: Dispatch<SetStateAction<string>>;
  handlesVisible: boolean;
  handlePoints: { corner: Corner; x: number; y: number }[];
  objectLayouts: Map<string, { height: number; limited: boolean; fadeStart: number; fadeEnd: number }>;
  displayedObjects: (Item & { displayHeight: number })[];
  edit: () => void;
};

export function useCanvasInput({
  model, commit, setBoard, clearHistory, finishTextSession, setView, trackPointer,
  setMessage, create, resizeStart, resizeStillValid, resizedBoard, movedBoard,
  scene, view, size, drag, busy, setBusy, spacePanRef, setSpacePan, setSelectionBox,
  selected, select, tool, setTool, readOnly, composing, inline, setInline, setPanel,
  handlesVisible, handlePoints, objectLayouts, displayedObjects, edit,
}: Input) {
  function point(e: { clientX: number; clientY: number }) {
    const r = scene.current!.getBoundingClientRect();
    return {
      x: view.x + (e.clientX - r.left - size.w / 2) / view.z,
      y: view.y + (e.clientY - r.top - size.h / 2) / view.z,
    };
  }
  function releaseCapture(pointerId?: number) {
    if (pointerId !== undefined && scene.current?.hasPointerCapture(pointerId)) {
      scene.current.releasePointerCapture(pointerId);
    }
  }
  function endSpacePan() {
    if (drag.current?.temporary) {
      const d = drag.current;
      drag.current = null;
      setBusy(false);
      releaseCapture(d.pointerId);
    }
    spacePanRef.current = false;
    setSpacePan(false);
  }
  function cancel() {
    const d = drag.current;
    if (d?.pan) setView(d.view);
    if (d?.box) select(d.previous ?? []);
    setSelectionBox(null);
    drag.current = null;
    setBusy(false);
    if (!d?.temporary) setTool("Select");
    releaseCapture(d?.pointerId);
    setBoard({ ...model.current });
  }
  useEffect(() => {
    const blur = () => {
      if (spacePanRef.current) {
        if (drag.current?.temporary) cancel();
        endSpacePan();
      } else cancel();
    };
    const keyup = (event: KeyboardEvent) => {
      if (event.code === "Space" && spacePanRef.current) endSpacePan();
    };
    window.addEventListener("blur", blur);
    window.addEventListener("keyup", keyup);
    return () => {
      window.removeEventListener("blur", blur);
      window.removeEventListener("keyup", keyup);
    };
  }, []);
  useEffect(() => {
    clearHistory();
    if (readOnly) cancel();
  }, [readOnly]);
  function sceneKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || composing) return;
    if (e.code === "Space") {
      e.preventDefault();
      if (!e.repeat && !drag.current) {
        spacePanRef.current = true;
        setSpacePan(true);
      }
      return;
    }
    if (e.key === "Enter" && !drag.current) {
      e.preventDefault();
      if (tool === "Sticky" || tool === "Text") {
        create(
          typeForTool(tool),
          view.x,
          view.y,
        );
      } else if (selected.size > 1) setMessage("Select one object to edit its text.");
      else edit();
    }
  }
  function pointerDown(e: React.PointerEvent<HTMLDivElement>) {
    trackPointer(e);
    if (
      e.target !== e.currentTarget &&
        !(e.target instanceof HTMLCanvasElement) &&
        !(e.target instanceof Element && e.target.closest(".resize-handle")) || composing || inline
    ) return;
    if (e.button !== 0 || drag.current) return;
    if (spacePanRef.current) {
      if (!e.isPrimary) return;
      drag.current = {
        id: "", x: view.x, y: view.y, cx: e.clientX, cy: e.clientY,
        view: { ...view }, pan: true, temporary: true, pointerId: e.pointerId,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      setBusy(true);
      e.preventDefault();
      return;
    }
    finishTextSession();
    const p = point(e);
    const handle = handlesVisible ? handlePoints.find((h) =>
      Math.abs((p.x - h.x) * view.z) <= 8 && Math.abs((p.y - h.y) * view.z) <= 8) : undefined;
    if (handle) {
      drag.current = {
        id: "", corner: handle.corner, resizeStart: resizeStart(),
        x: p.x, y: p.y, cx: e.clientX, cy: e.clientY,
        view: { ...view }, pan: false, pointerId: e.pointerId,
      };
      scene.current?.focus();
      e.currentTarget.setPointerCapture(e.pointerId);
      setBusy(true);
      e.preventDefault();
      return;
    }
    const hit = [...model.current.objects].reverse().find((o) =>
      p.x >= o.x && p.x <= o.x + o.width && p.y >= o.y &&
      p.y <= o.y + objectLayouts.get(o.id)!.height
    );
    if (tool === "Pan") {
      drag.current = {
        id: "",
        x: view.x,
        y: view.y,
        cx: e.clientX,
        cy: e.clientY,
        view: { ...view },
        pan: true,
      };
    } else if (tool === "Select") {
      if (hit) {
        if (e.shiftKey) {
          select(toggleGroup(model.current.objects, selected, hit.id));
        } else {
          const expanded = pressSelection(model.current.objects, selected, hit.id);
          const ids = selected.has(hit.id) ? [...selected] : [...expanded];
          if (readOnly || !selected.has(hit.id)) select(expanded);
          if (!readOnly) drag.current = {
            id: hit.id, ids, x: hit.x, y: hit.y,
            cx: e.clientX, cy: e.clientY, view: { ...view }, pan: false,
          };
        }
      } else {
        const previous = [...selected];
        if (!e.shiftKey) select("");
        drag.current = {
          id: "", box: true, additive: e.shiftKey, previous,
          x: p.x, y: p.y, cx: e.clientX, cy: e.clientY,
          view: { ...view }, pan: false,
        };
      }
    } else if (hit) {
      select(pressSelection(model.current.objects, selected, hit.id));
      setTool("Select");
    } else {
      drag.current = {
        id: tool, x: p.x, y: p.y, cx: e.clientX, cy: e.clientY,
        view: { ...view }, pan: false,
      };
    }
    scene.current?.focus();
    if (drag.current) {
      drag.current.pointerId = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      setBusy(true);
    }
  }
  function pointerMove(e: React.PointerEvent<HTMLDivElement>) {
    trackPointer(e);
    const d = drag.current;
    if (!d) return;
    if ((d.id === "Sticky" || d.id === "Text") &&
      Math.hypot(e.clientX - d.cx, e.clientY - d.cy) >= 3) {
      d.cancelled = true;
    }
    const dx = (e.clientX - d.cx) / d.view.z,
      dy = (e.clientY - d.cy) / d.view.z;
    if (d.corner && d.resizeStart) {
      if (!resizeStillValid(d.resizeStart)) { cancel(); return; }
      d.crossed ||= Math.hypot(e.clientX - d.cx, e.clientY - d.cy) >= 3;
      setBoard(d.crossed ? resizedBoard(d.corner, d.resizeStart, dx, dy, e.shiftKey)
        : { ...model.current });
    } else if (d.pan) {
      setView({
        x: clamp(d.x - dx, -1e6, 1e6),
        y: clamp(d.y - dy, -1e6, 1e6),
        z: d.view.z,
      });
    } else if (d.box) {
      if (Math.hypot(e.clientX - d.cx, e.clientY - d.cy) >= 3) {
        const end = { x: d.x + dx, y: d.y + dy };
        setSelectionBox({ x: Math.min(d.x, end.x), y: Math.min(d.y, end.y), width: Math.abs(dx), height: Math.abs(dy) });
        select(expandSelection(model.current.objects, [...(d.additive ? d.previous ?? [] : []), ...boxSelection(d, end, displayedObjects)]));
      } else {
        setSelectionBox(null);
        select(d.additive ? d.previous ?? [] : []);
      }
    } else if (d.ids && Math.hypot(e.clientX - d.cx, e.clientY - d.cy) >= 3) {
      setBoard(movedBoard(d.ids, dx, dy));
    } else setBoard({ ...model.current });
  }
  function pointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    drag.current = null;
    setBusy(false);
    if (!d) return;
    const delta = Math.hypot(e.clientX - d.cx, e.clientY - d.cy);
    if (d.corner && d.resizeStart) {
      if ((d.crossed || delta >= 3) && resizeStillValid(d.resizeStart)) {
        commit(resizedBoard(d.corner, d.resizeStart,
          (e.clientX - d.cx) / d.view.z, (e.clientY - d.cy) / d.view.z, e.shiftKey), true);
      }
      setBoard({ ...model.current });
    } else if (!d.pan && (d.id === "Sticky" || d.id === "Text")) {
      if (delta < 3 && !d.cancelled) {
        try {
          const next = add(
            model.current,
            typeForTool(d.id),
            d.x,
            d.y,
          );
          commit(next, true);
          select(next.objects.at(-1)!.id);
          setTool("Select");
          setPanel("");
          setInline(true);
        } catch (error) {
          setMessage(String(error));
        }
      } else setTool("Select");
    } else if (d.box) {
      if (delta >= 3) {
        const end = { x: d.x + (e.clientX - d.cx) / d.view.z, y: d.y + (e.clientY - d.cy) / d.view.z };
        select(expandSelection(model.current.objects, [...(d.additive ? d.previous ?? [] : []), ...boxSelection(d, end, displayedObjects)]));
      } else select(d.additive ? d.previous ?? [] : []);
    } else if (!d.pan) {
      if (delta >= 3 && d.ids) commit(movedBoard(d.ids,
        (e.clientX - d.cx) / d.view.z, (e.clientY - d.cy) / d.view.z), true);
      else {
        select(pressSelection(model.current.objects, selected, d.id));
        setBoard({ ...model.current });
      }
    }
    setSelectionBox(null);
    releaseCapture(d.pointerId);
  }
  function doubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (spacePanRef.current || composing || busy) return;
    const p = point(e);
    const hit = [...model.current.objects].reverse().find((o) =>
      p.x >= o.x && p.x <= o.x + o.width && p.y >= o.y &&
      p.y <= o.y + objectLayouts.get(o.id)!.height);
    if (!hit) return;
    select(hit.id);
    if (!readOnly) {
      setPanel("");
      setInline(true);
    }
  }
  function pointerCancel() {
    const d = drag.current;
    if (d?.pan) setView(d.view);
    cancel();
  }
  function lostPointerCapture() {
    if (drag.current) {
      const d = drag.current;
      if (d.pan) setView(d.view);
      cancel();
    }
  }
  return { cancel, sceneKeyDown, pointerDown, pointerMove, pointerUp, doubleClick, pointerCancel, lostPointerCapture };
}
