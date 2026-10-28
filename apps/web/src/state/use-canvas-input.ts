// SPDX-License-Identifier: Apache-2.0
import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import { add, clamp, type Board as SavedBoard, type BoardV9 as Board, type ResolvedItem as Item } from "../document";
import { expandSelection, pressSelection, toggleGroup } from "../group";
import { nearestHandle, type Corner } from "../resize";
import type { View } from "../view";
import { drawRectangle, dropped, placeObject, withMembers } from "../sections";
import { isContainer, hasText, inkInfo, isDrawingTool, isEraser, drawingKey, drawingStyleFor, type DrawingStyle, hasEnds, placementTool, typeForTool, toolForKey, creationValues, type ShapePaint, type ConnectorStyle } from "../objects/registry";
import type { Drag, ResizeStart } from "../gesture";

import { connectionDots, pressedDot, connectionTarget, pressedEnd, reconnectTarget } from "../connection-drag";
import { hitObject, selectInBox, createConnector, reconnect } from "../connectors";
import { deleteObject } from "../history";
import { drawingPoints, strokeGeometry, makeStroke, erasedStrokes } from "../strokes";
import { editingCommandReason } from "../commands";

type Input = {
  drawing: { style: DrawingStyle };
  connectorStyle: RefObject<ConnectorStyle>;
  shapeSession: { paint: RefObject<ShapePaint> };
  model: RefObject<Board>;
  commit: (input: SavedBoard, recordObject?: boolean, orderIds?: readonly string[]) => void;
  setBoard: Dispatch<SetStateAction<Board>>;
  clearHistory: () => void;
  finishTextSession: () => void;
  setView: Dispatch<SetStateAction<View>>;
  trackPointer: (e: React.PointerEvent) => void;
  setMessage: (value: string) => void;
  create: (tool: string, x: number, y: number, native?: boolean) => void;
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
  textEditing: boolean;
  invalidObjectText: boolean;
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
  drawing, connectorStyle, shapeSession, model, commit, setBoard, clearHistory, finishTextSession, setView, trackPointer,
  setMessage, create, resizeStart, resizeStillValid, resizedBoard, movedBoard,
  scene, view, size, drag, busy, setBusy, spacePanRef, setSpacePan, setSelectionBox,
  selected, select, tool, setTool, readOnly, composing, inline, setInline, setPanel,
  handlesVisible, handlePoints, objectLayouts, displayedObjects, edit, textEditing, invalidObjectText,
}: Input) {
  const canShowDots = tool === "Select" && !readOnly && !inline && !composing && !textEditing && !busy && !spacePanRef.current && !drag.current;
  const dots = canShowDots ? connectionDots(displayedObjects, selected, view.z) : [];
  const dotsVisible = dots.length > 0;
  const activeDrawing = drag.current?.drawing;
  const preview = activeDrawing && !isEraser(activeDrawing.tool) && (drag.current?.crossed || inkInfo(drawingStyleFor(activeDrawing.tool, drawing.style)).round)
    ? { ...drawingStyleFor(activeDrawing.tool, drawing.style), ...strokeGeometry(drawingPoints(activeDrawing.positions), drawingStyleFor(activeDrawing.tool, drawing.style)) } : null;
  const drawingCursor = isEraser(tool) ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14'%3E%3Ccircle cx='7' cy='7' r='6' fill='white' fill-opacity='.4' stroke='%235f5b66'/%3E%3C/svg%3E") 7 7, crosshair` : undefined;
  const connection = drag.current?.connection;
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
    if (!d?.temporary && !d?.drawing) setTool("Select");
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
    if (e.key === "Escape" && drag.current?.drawing) { e.preventDefault(); e.stopPropagation(); cancel(); return; }
    const drawTool = drawingKey(e.key, e.shiftKey);
    if (drawTool && !readOnly && !inline && !textEditing && !busy && !drag.current && !e.nativeEvent.isComposing && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault(); e.stopPropagation(); setTool(drawTool); return;
    }
    if (e.key === "Escape" && isDrawingTool(tool) && !drag.current) { e.preventDefault(); e.stopPropagation(); setTool("Select"); return; }
    if (e.key === "Enter" && isDrawingTool(tool)) { e.preventDefault(); e.stopPropagation(); return; }
    const kindTool = toolForKey(e.key);
    if (kindTool && !readOnly && !inline && !busy && !drag.current && !e.nativeEvent.isComposing &&
      !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      e.preventDefault(); setTool(kindTool); setInline(false); return;
    }
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
      if (placementTool(tool)) {
        create(
          tool,
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
        !(e.target instanceof Element && e.target.closest(".resize-handle,.connection-dot")) || composing || inline && !model.current.objects.some((o) => selected.has(o.id) && isContainer(o))
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
    if (isDrawingTool(tool)) {
      if (editingCommandReason({ readOnly, composing, pointerGesture: false, invalidObjectText })) return;
      drag.current = { id: "", x: p.x, y: p.y, cx: e.clientX, cy: e.clientY, view: { ...view }, pan: false,
        pointerId: e.pointerId, drawing: { positions: [p], tool } };
      setBusy(true); scene.current?.focus(); e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    const selectedConnector = canShowDots && selected.size === 1 ? displayedObjects.find((o) => selected.has(o.id) && hasEnds(o)) : undefined;
    const end = selectedConnector?.connectorLayout && e.isPrimary ? pressedEnd(selectedConnector.connectorLayout, p, view.z) : undefined;
    if (end && selectedConnector && hasEnds(selectedConnector) && !invalidObjectText) {
      drag.current = { id: selectedConnector.id, x: p.x, y: p.y, cx: e.clientX, cy: e.clientY, view: { ...view }, pan: false,
        pointerId: e.pointerId, connection: { source: selectedConnector[end === "from" ? "to" : "from"].object,
          start: p, pointer: p, target: null, reconnect: { id: selectedConnector.id, end } } };
      setBusy(true); scene.current?.focus(); e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    const dot = pressedDot(dots, p, view.z);
    if (dot && !editingCommandReason({ readOnly, composing, pointerGesture: false, invalidObjectText })) {
      drag.current = { id: dot.id, x: p.x, y: p.y, cx: e.clientX, cy: e.clientY, view: { ...view }, pan: false,
        pointerId: e.pointerId, connection: { source: dot.id, start: dot.start, pointer: p, target: null } };
      setBusy(true); scene.current?.focus(); e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    const handle = handlesVisible ? nearestHandle(handlePoints, p, view.z) : undefined;
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
    const hit = hitObject(displayedObjects, p, view.z);
    if (placementTool(tool)?.draws && !readOnly) {
      drag.current = { id: tool, x: p.x, y: p.y, cx: e.clientX, cy: e.clientY,
        view: { ...view }, pan: false };
    } else if (tool === "Pan") {
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
          const ids = [...withMembers(model.current.objects, selected.has(hit.id) ? selected : expanded)];
          if (readOnly || !selected.has(hit.id)) select(expanded);
          if (!readOnly) drag.current = {
            id: hit.id, ids: hasEnds(hit) ? undefined : ids, x: hit.x, y: hit.y,
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
    } else if (hit && !isContainer(hit)) {
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
    if (!d || d.connection?.reconnect && e.pointerId !== d.pointerId) return;
    if (d.drawing) {
      d.drawing.positions.push(point(e));
      d.crossed ||= Math.hypot(e.clientX - d.cx, e.clientY - d.cy) >= 3;
      setBoard({ ...model.current }); return;
    }
    if (d.connection) {
      const p = point(e);
      const target = d.connection.reconnect ? reconnectTarget(displayedObjects, d.connection.source, p, view.z) : null;
      d.connection = { ...d.connection, pointer: p, target: d.connection.reconnect ? target?.target ?? null : connectionTarget(displayedObjects, d.connection.source, p), side: target?.side };
      setBoard({ ...model.current }); return;
    }
    if (placementTool(d.id) && !placementTool(d.id)!.draws &&
      Math.hypot(e.clientX - d.cx, e.clientY - d.cy) >= 3) {
      d.cancelled = true;
    }
    const dx = (e.clientX - d.cx) / d.view.z,
      dy = (e.clientY - d.cy) / d.view.z;
    if (placementTool(d.id)?.draws) {
      d.crossed ||= Math.hypot(e.clientX - d.cx, e.clientY - d.cy) >= 3;
      setSelectionBox(d.crossed ? { x: Math.min(d.x, d.x + dx), y: Math.min(d.y, d.y + dy),
        width: Math.abs(dx), height: Math.abs(dy) } : null);
    } else if (d.corner && d.resizeStart) {
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
        select(expandSelection(model.current.objects, [...(d.additive ? d.previous ?? [] : []), ...selectInBox(d, end, displayedObjects)]));
      } else {
        setSelectionBox(null);
        select(d.additive ? d.previous ?? [] : []);
      }
    } else if (d.ids && Math.hypot(e.clientX - d.cx, e.clientY - d.cy) >= 3) {
      const next = movedBoard(d.ids, dx, dy);
      d.crossed = next !== model.current;
      setBoard(next !== model.current ? next : { ...model.current });
    } else {
      if (d.ids) d.crossed = false;
      setBoard({ ...model.current });
    }
  }
  function pointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (d?.connection?.reconnect && e.pointerId !== d.pointerId) return;
    drag.current = null;
    setBusy(false);
    if (!d) return;
    const delta = Math.hypot(e.clientX - d.cx, e.clientY - d.cy);
    if (d.drawing) {
      if (!editingCommandReason({ readOnly, composing, pointerGesture: false, invalidObjectText })) try {
        const positions = [...d.drawing.positions, point(e)];
        if (isEraser(d.drawing.tool)) {
          const touched = erasedStrokes(model.current.objects, positions, d.view.z);
          if (touched.length) commit(deleteObject(model.current, { past: [], future: [] }, touched).board, true);
        } else {
          const object = makeStroke(model.current, positions, drawingStyleFor(d.drawing.tool, drawing.style), !!d.crossed || delta >= 3, e.shiftKey);
          if (object) commit(placeObject(model.current, object), true);
        }
      } catch (error) { setMessage(String(error)); }
      setBoard({ ...model.current }); releaseCapture(d.pointerId); return;
    }
    if (d.connection) {
      const p = point(e), rect = scene.current!.getBoundingClientRect();
      if (d.connection.reconnect) {
        const target = e.clientX >= rect.left && e.clientY >= rect.top && e.clientX <= rect.right && e.clientY <= rect.bottom
          ? reconnectTarget(displayedObjects, d.connection.source, p, view.z) : null;
        if (target && !editingCommandReason({ readOnly, composing, pointerGesture: false, invalidObjectText })) {
          const { id, end } = d.connection.reconnect;
          const object = model.current.objects.filter(hasEnds).find((o) => o.id === id);
          const side = object?.[end].anchor;
          const drawnSide = side === "auto" ? displayedObjects.find((o) => o.id === id)?.connectorLayout?.[end].side : side;
          if (target.target !== object?.[end].object || target.side !== drawnSide) {
            commit(reconnect(model.current, id, end, { object: target.target, anchor: target.side }), true);
          }
        }
        setBoard({ ...model.current }); releaseCapture(d.pointerId); return;
      }
      const target = e.clientX >= rect.left && e.clientY >= rect.top && e.clientX <= rect.right &&
        e.clientY <= rect.bottom ? connectionTarget(displayedObjects, d.connection.source, p) : null;
      if (target && !editingCommandReason({ readOnly, composing, pointerGesture: false, invalidObjectText })) {
        try {
          const result = createConnector(model.current, d.connection.source, target, connectorStyle.current);
          commit(result.board, true); select(result.id); setInline(false); setPanel(""); scene.current?.focus();
        } catch (error) { setMessage(String(error)); }
      }
      setBoard({ ...model.current }); releaseCapture(d.pointerId); return;
    }
    if (d.corner && d.resizeStart) {
      if ((d.crossed || delta >= 3) && resizeStillValid(d.resizeStart)) {
        commit(resizedBoard(d.corner, d.resizeStart,
          (e.clientX - d.cx) / d.view.z, (e.clientY - d.cy) / d.view.z, e.shiftKey), true);
      }
      setBoard({ ...model.current });
    } else if (!d.pan && placementTool(d.id)) {
      if (placementTool(d.id)!.draws || delta < 3 && !d.cancelled) {
        try {
          let object = creationValues(add(model.current, typeForTool(d.id), d.x, d.y).objects.at(-1)!, d.id, shapeSession.paint.current);
          if (placementTool(d.id)!.draws && delta >= 3) {
            object = { ...object, ...drawRectangle(d, {
              x: d.x + (e.clientX - d.cx) / d.view.z, y: d.y + (e.clientY - d.cy) / d.view.z,
            }, placementTool(d.id)!.sizeRange) };
          }
          const next = placeObject(model.current, object);
          commit(next, true);
          select(object.id);
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
        select(expandSelection(model.current.objects, [...(d.additive ? d.previous ?? [] : []), ...selectInBox(d, end, displayedObjects)]));
      } else select(d.additive ? d.previous ?? [] : []);
    } else if (!d.pan) {
      if (delta >= 3 && d.ids) {
        const next = movedBoard(d.ids, (e.clientX - d.cx) / d.view.z, (e.clientY - d.cy) / d.view.z);
        if (next !== model.current) commit(dropped(next, new Set(d.ids)), true);
        setBoard({ ...model.current });
      }
      else {
        select(pressSelection(model.current.objects, selected, d.id));
        setBoard({ ...model.current });
      }
    }
    setSelectionBox(null);
    releaseCapture(d.pointerId);
  }
  function doubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (spacePanRef.current || composing || busy || isDrawingTool(tool)) return;
    const p = point(e);
    const hit = hitObject(displayedObjects, p, view.z);
    if (!hit) return;
    select(hit.id);
    if (!readOnly && hasText(hit)) {
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
  return { preview, drawingCursor, dots, dotsVisible, connection, cancel, sceneKeyDown, pointerDown, pointerMove, pointerUp, doubleClick, pointerCancel, lostPointerCapture };
}
