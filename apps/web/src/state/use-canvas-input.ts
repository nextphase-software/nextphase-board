// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { add, clamp, type Board as SavedBoard, type BoardV14 as Board, type TapeItem, type TableItem } from "nextphase-board-rules/document.ts";
import type { ResolvedItem as Item } from "../geometry";
import { expandSelection, pressSelection, toggleGroup } from "../group";
import { nearestHandle, type Corner } from "../resize";
import type { View } from "../view";
import { drawRectangle, dropped, placeObject, withMembers } from "../sections";
import { hasPlayMark, videoFrame } from "../video.ts";
import { isMedia, isTape, isTable, table, type TapePattern, isContainer, hasText, inkInfo, isDrawingTool, isEraser, drawingKey, drawingStyleFor, type DrawingStyle, hasEnds, placementTool, typeForTool, toolForKey, creationValues, isMindNode, type ShapePaint, type ConnectorStyle } from "nextphase-board-rules/objects/registry.ts";
import type { Drag, NodeDrop, ResizeStart } from "../gesture";
import { branchIds, dropTarget, MAP_WORDS } from "../mind-map";

import { connectionDots, pressedDot, connectionTarget, pressedEnd, reconnectTarget } from "../connection-drag";
import { hitObject, selectInBox, createConnector, reconnect } from "../connectors";
import { deleteObject } from "../history";
import { drawingPoints, strokeGeometry, makeStroke, erasedStrokes } from "../strokes";
import { makeTape, tapeGeometry, tapeEnds, moveTapeEnd } from "../tape";
import type { FindActions } from "../find";
import type { TidyActions } from "../tidy-up";
import { editingCommandReason } from "../commands";
import { isMac, type LinkPointer, type LinkPress } from "../text-links";
import { chooseCell, chooseHow } from "../table-selection";
import type { TablePointer } from "../table-arrange";

import type { BoardVoting } from "../team/voting";

import { TABLE_LEVEL, hitBorder, hitCell, tableGhost, tableKey, tableBorders, type TableAction, type TableBorder, type TableGhost, type TableLayout, type TableSelection } from "../table";
import type { CellAddress } from "nextphase-board-rules/objects/registry.ts";

type Input = {
  linkPointer?: () => LinkPointer;
  tablePointer?: () => TablePointer;
  animated?: ReadonlySet<string>; bitmaps?: ReadonlyMap<string, ImageBitmap>;
  tableSelection?: TableSelection;
  chooseTable: (selection: TableSelection, table: TableItem) => void;
  tableGeometry: {
    editCell: (table: TableItem, at: CellAddress) => void;
    resizedTableBorder: (table: TableItem, border: TableBorder, start: TableLayout, delta: number) => TableItem;
  };
  tableAction: (action: TableAction) => void;
  page: string;
  voting?: BoardVoting;
  tidy?: TidyActions;
  find?: FindActions;
  drawing: { style: DrawingStyle; pattern?: TapePattern };
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
  create: (tool: string, x: number, y: number, native?: boolean, released?: boolean, dimensions?: { columns: number; rows: number }) => void;
  resizeStart: () => ResizeStart[];
  resizeStillValid: (start: ResizeStart[]) => boolean;
  resizedBoard: (corner: Corner, start: ResizeStart[], dx: number, dy: number, shift: boolean) => Board;
  movedBoard: (ids: string[], dx: number, dy: number, drop?: NodeDrop) => Board;
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
  tableSelection, chooseTable, tableGeometry, tableAction, page, voting, drawing, tidy, find, connectorStyle, shapeSession, model, commit, setBoard, clearHistory, finishTextSession, setView, trackPointer,
  setMessage, create, resizeStart, resizeStillValid, resizedBoard, movedBoard,
  scene, view, size, drag, busy, setBusy, spacePanRef, setSpacePan, setSelectionBox,
  selected, select, tool, setTool, readOnly, composing, inline, setInline, setPanel,
  handlesVisible, handlePoints, objectLayouts, displayedObjects, edit, textEditing, invalidObjectText, animated = new Set(), bitmaps = new Map(), linkPointer, tablePointer,
}: Input) {
  const tableDrag = useRef<{ object: TableItem; border: TableBorder; layout: TableLayout } | null>(null);
  const ghost = useRef<TableGhost | null>(null);
  const [hoverAxis, setHoverAxis] = useState<TableBorder["axis"]>();
  const [hover, setHover] = useState({ key: "", id: "" });
  const [pressedPlay, setPressedPlay] = useState({ id: "", sequence: 0 });
  const hoverAllowed = tool === "Select" && !busy && !drag.current && !inline && !textEditing &&
    (!!animated.size || displayedObjects.some(object => videoFrame(object, bitmaps)));
  const hoverKey = hoverAllowed ? [model.current.boardId, page, tool, view.x, view.y, view.z].join("/") : "";
  const hovered = hoverAllowed && hover.key === hoverKey ? hover.id : "";
  if (hover.id && (!hoverAllowed || hover.key !== hoverKey)) setHover({ key: hoverKey, id: "" });
  const pointerLeave = () => { if (hover.id) setHover({ key: hoverKey, id: "" }); linkPointer?.().leave(); tablePointer?.().leave(); };
  const linkPress = useRef<{ press: LinkPress; cx: number; cy: number; pointerId: number; crossed: boolean } | null>(null);
  const tableTarget = displayedObjects.find(o => o.id === tableSelection?.id);
  const selectedTable = tableTarget && isTable(tableTarget) ? tableTarget : undefined;
  const tapeEnd = useRef<{object:TapeItem & { page: string };end:number;pointer:number}|null>(null);
  tidy?.measure(displayedObjects);
  const canShowDots = !tidy?.open && tool === "Select" && !readOnly && !inline && !composing && !textEditing && !busy && !spacePanRef.current && !drag.current;
  const dots = canShowDots ? connectionDots(displayedObjects, selected, view.z) : [];
  const dotsVisible = dots.length > 0;
  const activeDrawing = drag.current?.drawing;
  const preview = activeDrawing?.tool === "Washi tape" ? {pattern:drawing.pattern ?? "stripes",...tapeGeometry(activeDrawing.positions[0],activeDrawing.positions.at(-1)!)} : activeDrawing && !isEraser(activeDrawing.tool) && (drag.current?.crossed || inkInfo(drawingStyleFor(activeDrawing.tool, drawing.style)).round)
    ? { ...drawingStyleFor(activeDrawing.tool, drawing.style), ...strokeGeometry(drawingPoints(activeDrawing.positions), drawingStyleFor(activeDrawing.tool, drawing.style)) }
    : drag.current?.mapDrag && drag.current.crossed ? { mapDrag: drag.current.mapDrag } : null;
  const inkCursor = isEraser(tool) ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14'%3E%3Ccircle cx='7' cy='7' r='6' fill='white' fill-opacity='.4' stroke='%235f5b66'/%3E%3C/svg%3E") 7 7, crosshair` : undefined;
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
    tablePointer?.().cancel();
    linkPress.current = null;
    const d = drag.current;
    tapeEnd.current = null; tableDrag.current = null; ghost.current = null; setHoverAxis(undefined);
    if (d?.pan) setView(d.view);
    if (d?.box) select(d.previous ?? []);
    setSelectionBox(null);
    drag.current = null;
    setBusy(false);
    if (!d?.temporary && !d?.drawing && d?.id !== table.tool) setTool((tool) => tool === "Comment" ? tool : "Select");
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
  function tableKeys(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape" && tablePointer?.().dragging()) {
      e.preventDefault(); e.stopPropagation(); tablePointer().cancel(); return true;
    }
    if (e.key === "Escape" && (drag.current?.id === table.tool || tableDrag.current)) {
      e.preventDefault(); e.stopPropagation(); cancel(); return true;
    }
    if (selectedTable && tableSelection && tool === "Select" && !inline && !busy && !tidy?.open) {
      const result = tableKey(selectedTable, tableSelection, e, false, readOnly, composing);
      if (result) {
        e.preventDefault(); e.stopPropagation();
        if ("action" in result) tableAction(result.action);
        else if ("choose" in result) chooseTable(result.choose, selectedTable);
        else if ("select" in result) chooseTable({ kind: "cell", id: selectedTable.id, ...result.select }, selectedTable);
        else if ("edit" in result) tableGeometry.editCell(selectedTable, result.edit);
        else if ("exit" in result) select(result.exit ? "" : selectedTable.id);
        return true;
      }
    }
    if (e.code === "KeyT" && e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && !readOnly && !busy && !inline && !textEditing && !tidy?.open) {
      e.preventDefault(); e.stopPropagation(); setTool(toolForKey("t", true)!); return true;
    }
    if (e.key === "Escape" && tool === table.tool) { e.preventDefault(); e.stopPropagation(); setTool("Select"); return true; }
    return false;
  }
  function sceneKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || composing || e.nativeEvent?.isComposing) {
      if ((composing || e.nativeEvent?.isComposing) && tableSelection && tableSelection.kind !== TABLE_LEVEL) e.stopPropagation();
      return;
    }
    if (e.shiftKey && (e.code === "Digit1" || e.code === "Digit2") && !e.ctrlKey && !e.metaKey && !e.altKey &&
      !inline && !textEditing && !e.nativeEvent.isComposing && !busy && !drag.current && !tidy?.open) {
      e.preventDefault(); e.stopPropagation(); e.code === "Digit1" ? find?.zoomToFit() : find?.zoomToSelection(); return;
    }
    if(voting?.key(e,selected))return;
    if (tidy?.open && (e.key === "Escape" || e.key === "Enter")) { e.preventDefault(); e.stopPropagation(); e.key === "Escape" ? tidy.cancel(true) : tidy.apply(); return; }
    if (e.code === "KeyT" && e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && !inline && !textEditing && !e.nativeEvent.isComposing) {
      e.preventDefault(); e.stopPropagation(); tidy?.start({readOnly,composing,pointerGesture:busy,invalidObjectText}); return;
    }
    if (e.key === "Escape" && (drag.current?.drawing || tapeEnd.current)) { e.preventDefault(); e.stopPropagation(); cancel(); return; }
    if (!readOnly && tableKeys(e)) return;
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
    if (e.key === "Enter" && !drag.current && !e.metaKey && !e.ctrlKey && !(selectedTable && readOnly)) {
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
    linkPress.current = null;
    const links = linkPointer?.();
    const eligible = links && e.button === 0 && e.isPrimary && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey &&
      !inline && !composing && !drag.current && tool === "Select" && !voting?.mode && !tidy?.open && !spacePanRef.current &&
      (e.target === e.currentTarget || e.target instanceof HTMLCanvasElement);
    const press = eligible ? links.press(point(e)) : undefined;
    const repeated = links?.repeats(press);
    trackPointer(e);
    if (
      e.target !== e.currentTarget &&
        !(e.target instanceof HTMLCanvasElement) &&
        !(e.target instanceof Element && e.target.closest(".resize-handle,.connection-dot")) || composing || inline && !model.current.objects.some((o) => selected.has(o.id) && (isContainer(o) || isTable(o)))
    ) return;
    if (e.button !== 0 || drag.current) return;
    if (tidy?.open) { tidy.cancel(); e.preventDefault(); return; }
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
    const p = point(e);
    if (hovered && e.isPrimary && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey && !voting?.mode) {
      const hit = hitObject(displayedObjects, p, view.z);
      if (hit && hit.id === hovered && isMedia(hit) && hasPlayMark(hit, animated, bitmaps) && !selected.has(hit.id) &&
          hit.width * view.z >= 56 && hit.height * view.z >= 56 &&
          Math.hypot(p.x - hit.x - hit.width / 2, p.y - hit.y - hit.height / 2) * view.z <= 20) {
        setPressedPlay(previous => ({ id: hit.id, sequence: previous.sequence + 1 }));
      }
    }
    if(voting?.pointerDown(e,hitObject(displayedObjects,p,view.z))){scene.current?.focus();e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();return;}
    finishTextSession();
    if (inline && selectedTable) setInline(false);
    if (tool === table.tool && !readOnly) {
      drag.current = { id: tool, x: p.x, y: p.y, cx: e.clientX, cy: e.clientY, view: { ...view }, pan: false, pointerId: e.pointerId };
      setBusy(true); scene.current?.focus(); e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    if (isDrawingTool(tool)) {
      if (editingCommandReason({ readOnly, composing, pointerGesture: false, invalidObjectText })) return;
      drag.current = { id: "", x: p.x, y: p.y, cx: e.clientX, cy: e.clientY, view: { ...view }, pan: false,
        pointerId: e.pointerId, drawing: { positions: [p], tool } };
      setBusy(true); scene.current?.focus(); e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); return;
    }
    const selectedTape = canShowDots && selected.size === 1 ? model.current.objects.filter(isTape).find(o=>selected.has(o.id)) : undefined;
    const endIndex = selectedTape ? tapeEnds(selectedTape).findIndex(end=>Math.abs(end.x-p.x)<=10/view.z&&Math.abs(end.y-p.y)<=10/view.z) : -1;
    if (selectedTape && endIndex>=0 && e.isPrimary && !invalidObjectText) {
      tapeEnd.current={object:selectedTape,end:endIndex,pointer:e.pointerId};
      drag.current={id:selectedTape.id,x:p.x,y:p.y,cx:e.clientX,cy:e.clientY,view:{...view},pan:false,pointerId:e.pointerId};
      setBusy(true);scene.current?.focus();e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();return;
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
    if (tool === "Select" && selectedTable?.tableLayout && tableSelection && tableSelection.kind !== TABLE_LEVEL &&
        (e.shiftKey || e.ctrlKey || e.metaKey)) {
      const how = chooseHow(e, isMac(navigator.platform));
      const hit = how && hitObject(displayedObjects, p, view.z);
      const cell = hit && hit.id === selectedTable.id ? hitCell(selectedTable, selectedTable.tableLayout, p) : undefined;
      if (cell) {
        chooseTable(chooseCell(selectedTable, tableSelection, cell, readOnly ? undefined : how), selectedTable);
        scene.current?.focus(); e.preventDefault(); return;
      }
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
    const border = tool === "Select" && !readOnly && !e.shiftKey && !inline && selectedTable?.tableLayout
      ? hitBorder(selectedTable, selectedTable.tableLayout, p, view.z) : undefined;
    if (border && selectedTable?.tableLayout) {
      const saved = model.current.objects.find(o => o.id === selectedTable.id && isTable(o)) as TableItem;
      tableDrag.current = { object: saved, border, layout: selectedTable.tableLayout };
      drag.current = { id: saved.id, x: p.x, y: p.y, cx: e.clientX, cy: e.clientY, view: { ...view }, pan: false, pointerId: e.pointerId };
      setBusy(true); scene.current?.focus(); e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); return;
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
        if (press && !repeated) linkPress.current = { press, cx: e.clientX, cy: e.clientY, pointerId: e.pointerId, crossed: false };
        if (e.shiftKey) {
          select(toggleGroup(model.current.objects, selected, hit.id));
        } else {
          const expanded = pressSelection(model.current.objects, selected, hit.id);
          const ids = [...withMembers(model.current.objects, selected.has(hit.id) ? selected : expanded)];
          if (readOnly || !selected.has(hit.id)) {
            const cell = selectedTable?.id === hit.id && isTable(hit) && hit.tableLayout ? hitCell(hit, hit.tableLayout, p) : undefined;
            if (cell && isTable(hit)) chooseTable({ kind: "cell", id: hit.id, ...cell }, hit);
            else select(expanded);
          }
          if (!readOnly) drag.current = {
            id: hit.id, ids: hasEnds(hit) ? undefined : ids, x: hit.x, y: hit.y,
            cx: e.clientX, cy: e.clientY, view: { ...view }, pan: false,
            ...(selected.size === 1 && selected.has(hit.id) && isTable(hit) ? { tableCellClick: true } : {}),
            // One node pressed and dragged carries its branch and may reparent.
            ...(ids.length === 1 && isMindNode(hit) ? { mapDrag: { node: hit.id, branch: branchIds(model.current.objects, hit.id),
              root: hit.parent === null, target: null, side: "right" as const } } : {}),
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
    } else if (linkPress.current) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setBusy(true);
    }
  }
  function pointerMove(e: React.PointerEvent<HTMLDivElement>) {
    trackPointer(e);
    const link = linkPress.current;
    if (link?.pointerId === e.pointerId) link.crossed ||= Math.hypot(e.clientX - link.cx, e.clientY - link.cy) >= 3;
    linkPointer?.().move(point(e), e);
    tablePointer?.().move(point(e), e);
    if (drag.current?.arrange) return;
    const d = drag.current;
    const hit = hoverAllowed && e.buttons === 0 ? hitObject(displayedObjects, point(e), view.z) : undefined;
    const id = hit && isMedia(hit) && hasPlayMark(hit, animated, bitmaps) && !selected.has(hit.id) ? hit.id : "";
    if (id !== hovered) setHover({ key: hoverKey, id });
    if(!d&&voting?.pointerMove(e,hitObject(displayedObjects,point(e),view.z)))return;
    if (!d) {
      const border = !readOnly && !inline && tool === "Select" && !spacePanRef.current && selectedTable?.tableLayout
        ? hitBorder(selectedTable, selectedTable.tableLayout, point(e), view.z) : undefined;
      if (border?.axis !== hoverAxis) setHoverAxis(border?.axis);
    }
    if (!d || d.connection?.reconnect && e.pointerId !== d.pointerId) return;
    if (tapeEnd.current) {
      const end=tapeEnd.current;if(e.pointerId!==end.pointer)return;
      const live=model.current.objects.find(o=>o.id===end.object.id);
      if(JSON.stringify(live)!==JSON.stringify(end.object)){cancel();return;}
      const moved=moveTapeEnd(end.object,end.end,point(e));
      setBoard({...model.current,objects:model.current.objects.map(o=>o.id===moved.id?moved:o)});return;
    }
    if (d.id === table.tool) {
      d.crossed ||= Math.hypot(e.clientX - d.cx, e.clientY - d.cy) >= 3;
      ghost.current = d.crossed ? tableGhost(d, point(e), true) : null;
      setBoard({ ...model.current }); return;
    }
    if (tableDrag.current) {
      const drag = tableDrag.current, live = model.current.objects.find(o => o.id === drag.object.id);
      if (JSON.stringify(live) !== JSON.stringify(drag.object)) { cancel(); return; }
      const delta = drag.border.axis === "row" ? (e.clientY - d.cy) / d.view.z : (e.clientX - d.cx) / d.view.z;
      const next = tableGeometry.resizedTableBorder(drag.object, drag.border, drag.layout, delta);
      setBoard({ ...model.current, objects: model.current.objects.map(o => o.id === drag.object.id ? next : o) });
      return;
    }
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
    } else if (d.ids && d.mapDrag && Math.hypot(e.clientX - d.cx, e.clientY - d.cy) >= 3) {
      const next = movedBoard(d.ids, dx, dy, { preview: true });
      const target = dropTarget(next.objects.filter(o => o.page === page), point(e), new Set(d.mapDrag.branch));
      d.mapDrag = { ...d.mapDrag, target: target?.target ?? null, side: target?.side ?? "right" };
      d.crossed = true;
      setBoard(next);
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
    if (drag.current?.arrange) return;
    const link = linkPress.current;
    const follow = link && link.pointerId === e.pointerId && !link.crossed &&
      Math.hypot(e.clientX - link.cx, e.clientY - link.cy) < 3 && !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey &&
      tool === "Select" && !inline && !voting?.mode && !tidy?.open ? link.press : undefined;
    if (link?.pointerId === e.pointerId) linkPress.current = null;
    if(!drag.current&&voting?.pointerUp(e,hitObject(displayedObjects,point(e),view.z))){releaseCapture(e.pointerId);return;}
    const d = drag.current;
    if (d?.connection?.reconnect && e.pointerId !== d.pointerId) return;
    if(tapeEnd.current&&e.pointerId!==tapeEnd.current.pointer)return;
    const tapeDrag=tapeEnd.current;tapeEnd.current=null;
    drag.current = null;
    setBusy(false);
    if(tapeDrag) {
      if(!editingCommandReason({readOnly,composing,pointerGesture:false,invalidObjectText})&&JSON.stringify(model.current.objects.find(o=>o.id===tapeDrag.object.id))===JSON.stringify(tapeDrag.object)) {
        const moved=moveTapeEnd(tapeDrag.object,tapeDrag.end,point(e));
        commit({...model.current,objects:model.current.objects.map(o=>o.id===moved.id?moved:o)},true);
      }
      setBoard({...model.current});releaseCapture(d?.pointerId);return;
    }
    if (!d) {
      if (link?.pointerId === e.pointerId) releaseCapture(e.pointerId);
      if (follow) linkPointer?.().follow(follow, point(e));
      return;
    }
    const delta = Math.hypot(e.clientX - d.cx, e.clientY - d.cy);
    if (d.id === table.tool) {
      const dimensions = tableGhost(d, point(e), !!d.crossed || delta >= 3);
      ghost.current = null; setBoard({ ...model.current }); releaseCapture(d.pointerId);
      create(table.tool, dimensions.x, dimensions.y, false, true, dimensions); return;
    }
    if (tableDrag.current) {
      const drag = tableDrag.current; tableDrag.current = null;
      const live = model.current.objects.find(o => o.id === drag.object.id);
      if (!readOnly && delta >= 3 && JSON.stringify(live) === JSON.stringify(drag.object)) {
        const amount = drag.border.axis === "row" ? (e.clientY - d.cy) / d.view.z : (e.clientX - d.cx) / d.view.z;
        const next = tableGeometry.resizedTableBorder(drag.object, drag.border, drag.layout, amount);
        commit({ ...model.current, objects: model.current.objects.map(o => o.id === next.id ? next : o) }, true);
      }
      setBoard({ ...model.current }); releaseCapture(d.pointerId); return;
    }
    if (d.drawing) {
      if (!editingCommandReason({ readOnly, composing, pointerGesture: false, invalidObjectText })) try {
        const positions = [...d.drawing.positions, point(e)];
        if (isEraser(d.drawing.tool)) {
          const touched = erasedStrokes(model.current.objects.filter(o => o.page === page), positions, d.view.z);
          if (touched.length) commit(deleteObject(model.current, { past: [], future: [] }, touched).board, true);
        } else if (d.drawing.tool === "Washi tape") {
          commit(placeObject(model.current,makeTape(model.current,positions[0],positions.at(-1)!,drawing.pattern??"stripes",!(d.crossed||delta>=3),page)),true);
        } else {
          const object = makeStroke(model.current, positions, drawingStyleFor(d.drawing.tool, drawing.style), !!d.crossed || delta >= 3, e.shiftKey, page);
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
          const result = createConnector(model.current, d.connection.source, target, connectorStyle.current, page);
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
      if (isMindNode({ type: typeForTool(d.id) }) && delta < 3 && !d.cancelled) create(d.id, d.x, d.y, false, true);
      else if (placementTool(d.id)!.draws || delta < 3 && !d.cancelled) {
        try {
          let object = creationValues(add(model.current, typeForTool(d.id), d.x, d.y, page).objects.at(-1)!, d.id, shapeSession.paint.current);
          if (placementTool(d.id)!.draws && delta >= 3) {
            object = { ...object, ...drawRectangle(d, {
              x: d.x + (e.clientX - d.cx) / d.view.z, y: d.y + (e.clientY - d.cy) / d.view.z,
            }, placementTool(d.id)!.sizeRange) };
          }
          const next = placeObject(model.current, object, objectLayouts);
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
      if (delta >= 3 && d.ids && d.mapDrag) {
        const { node, target, side, root } = d.mapDrag, before = model.current;
        const next = movedBoard(d.ids, (e.clientX - d.cx) / d.view.z, (e.clientY - d.cy) / d.view.z, { target, side });
        if (next !== before) {
          commit(next, true);
          const name = (id: string | null) => before.objects.find((o) => o.id === id && hasText(o)) as { text: string } | undefined;
          if (model.current !== before && (target || !root)) setMessage(target ? MAP_WORDS.moved(name(node)!.text, name(target)!.text) : MAP_WORDS.separate(name(node)!.text));
        }
        setBoard({ ...model.current });
      } else if (delta >= 3 && d.ids) {
        const next = movedBoard(d.ids, (e.clientX - d.cx) / d.view.z, (e.clientY - d.cy) / d.view.z);
        if (next !== model.current) commit(dropped(next, new Set(d.ids), objectLayouts), true);
        setBoard({ ...model.current });
      }
      else {
        const cell = selectedTable?.id === d.id && selectedTable.tableLayout ? hitCell(selectedTable, selectedTable.tableLayout, point(e)) : undefined;
        if (cell && selectedTable && d.tableCellClick) chooseTable({ kind: "cell", id: d.id, ...cell }, selectedTable);
        else select(pressSelection(model.current.objects, selected, d.id));
        setBoard({ ...model.current });
      }
    }
    setSelectionBox(null);
    releaseCapture(d.pointerId);
    if (follow) linkPointer?.().follow(follow, point(e));
  }
  function doubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (linkPointer?.().doubled(point(e))) return;
    if(voting?.mode||tidy?.open)return;
    if (spacePanRef.current || composing || busy || isDrawingTool(tool) || tool === "Comment") return;
    const p = point(e);
    const hit = hitObject(displayedObjects, p, view.z);
    if (!hit) return;
    if (!readOnly && isTable(hit) && hit.tableLayout) {
      const cell = hitCell(hit, hit.tableLayout, p);
      if (cell) tableGeometry.editCell(hit, cell);
      return;
    }
    select(hit.id);
    if (!readOnly && hasText(hit)) {
      setPanel("");
      setInline(true);
    }
  }
  function pointerCancel() {
    voting?.cancelPointer();
    const d = drag.current;
    if (d?.pan) setView(d.view);
    cancel();
  }
  function lostPointerCapture() {
    if (drag.current?.arrange) return;
    voting?.cancelPointer();
    if (drag.current || linkPress.current) {
      const d = drag.current;
      if (d?.pan) setView(d.view);
      cancel();
    }
  }
  const border = tableDrag.current && selectedTable?.tableLayout
    ? tableBorders(selectedTable, selectedTable.tableLayout).find(b => b.id === tableDrag.current?.border.id) : undefined;
  const cursorAxis = tableDrag.current?.border.axis ?? (!readOnly && !inline && !busy && selectedTable && tool === "Select" ? hoverAxis : undefined);
  const drawingCursor = cursorAxis ? cursorAxis === "row" ? "row-resize" : "col-resize" : inkCursor;
  return { hovered, pressedPlay, pointerLeave, tableGesture: { ghost: ghost.current, border, resizing: !!tableDrag.current || !!drag.current?.corner, cancelDrag: () => { if (tableDrag.current || selectedTable && drag.current?.corner) cancel(); }, focus: () => scene.current?.focus() }, preview, drawingCursor, dots, dotsVisible, connection, cancel, sceneKeyDown, pointerDown, pointerMove, pointerUp, doubleClick, pointerCancel, lostPointerCapture };
}
