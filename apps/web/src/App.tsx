// SPDX-License-Identifier: Apache-2.0
import { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import {
  count,
  type ItemV3 as Item,
  validText,
} from "./document";
import { colorEntry, textUnits, type Style } from "./styles";
import { allowedHeight, displayHeight, neededHeight, TEXT_INSET, TEXT_LAYOUT } from "./geometry";
import { type View } from "./view";
import { boundingBox } from "./selection";
import { editingCommandReason } from "./commands";
import { type Corner, type Rectangle } from "./resize";
import { groupNumbers, wholeGroups } from "./group";

import { useMessages } from "./state/use-messages";
import { useBoardDocument } from "./state/use-board-document";
import { useStorageSession } from "./state/use-storage-session";
import { useEditingCommands } from "./state/use-editing-commands";
import { useGeometryEdits } from "./state/use-geometry-edits";
import { useCanvasInput } from "./state/use-canvas-input";
import { usePageKeys } from "./state/use-page-keys";
import { usePanelLayout } from "./state/use-panel-layout";
import { useContextBar } from "./state/use-context-bar";
import { useViewport } from "./state/use-viewport";
import { useSceneSize } from "./state/use-scene-size";

import { BoardDrawing } from "./scene/board-drawing";
import { Overlays } from "./scene/overlays";
import { InlineEditor } from "./scene/inline-editor";

import { FileBar } from "./ui/file-bar";
import { SaveArea } from "./ui/save-area";
import { Notice } from "./ui/notice";
import { BoardPanel } from "./ui/board-panel";
import { ObjectsPanel } from "./ui/objects-panel";
import { ContextBar } from "./ui/context-bar";
import { Palette } from "./ui/palette";
import { ZoomControls } from "./ui/zoom-controls";
import { InformationButton } from "./ui/information-button";
import { InformationPanel } from "./ui/information-panel";
import { NavigationPanel } from "./ui/navigation-panel";

const CORNERS: Corner[] = ["nw", "ne", "sw", "se"];
type ResizeStart = { object: Item; rectangle: Rectangle };

function lineCount(object: Item, text = object.text): number {
  // Auto height is essential here: a fixed height would count only visible lines.
  const measurement = new Konva.Text({
    ...TEXT_LAYOUT,
    fontSize: textUnits(object.textSize),
    width: object.width - 2 * TEXT_INSET,
    text,
  });
  const lines = Math.max(1, measurement.textArr.length);
  measurement.destroy();
  return lines;
}

export function App() {
  const [selected, setSelected] = useState<Set<string>>(() => new Set()),
    [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null),
    [tool, setTool] = useState("Select"),
    [panel, setPanel] = useState(""),
    [inline, setInline] = useState(false),
    [readOnly, setReadOnly] = useState(true),
    [status, setStatus] = useState("Unsaved"),
    [busy, setBusy] = useState(false),
    [spacePan, setSpacePan] = useState(false),
    [composing, setComposing] = useState(false);
  const { setMessage, messageSequence, latestAcknowledgement, visibleMessage } = useMessages();
  const {
    board, setBoard, title, setTitle, drafts, setDrafts, history,
    model, historyRef, textSession, revision, adapter,
    updateHistory, clearHistory, beginTextSession, finishTextSession, commit, load,
  } = useBoardDocument({ readOnly, setStatus });
  const scene = useRef<HTMLDivElement>(null),
    contextBar = useRef<HTMLElement>(null),
    colourControl = useRef<HTMLSpanElement>(null),
    colourButton = useRef<HTMLButtonElement>(null),
    swatches = useRef<HTMLDivElement>(null),
    arrangeControl = useRef<HTMLSpanElement>(null),
    arrangeButton = useRef<HTMLButtonElement>(null),
    arrangeMenu = useRef<HTMLDivElement>(null),
    inlineSurface = useRef<HTMLElement>(null),
    spacePanRef = useRef(false),
    editor = useRef<HTMLTextAreaElement>(null),
    selector = useRef<HTMLSelectElement>(null),
    objectsButton = useRef<HTMLButtonElement>(null),
    drag = useRef<
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
    >(null);
  const selectedObjects = board.objects.filter((o) => selected.has(o.id));
  const selectionKey = JSON.stringify(selectedObjects.map((o) => o.id));
  const selectedId = selectedObjects.length === 1 ? selectedObjects[0].id : "";
  const item = board.objects.find((o) => o.id === selectedId),
    text = item ? (drafts[item.id] ?? item.text) : "";
  const objectLayouts = useMemo(() => new Map(board.objects.map((o) => {
    // Uncommitted composition/invalid input may grow the editor's preview only.
    const lines = lineCount(o, inline && o.id === selectedId ? text : o.text);
    const fontSize = textUnits(o.textSize);
    const height = displayHeight(o, lines, fontSize);
    const innerHeight = height - 2 * TEXT_INSET;
    const lineHeight = fontSize * TEXT_LAYOUT.lineHeight;
    const visibleLines = Math.floor(innerHeight / lineHeight);
    return [o.id, {
      height,
      limited: neededHeight(lines, fontSize) > allowedHeight(o.y),
      fadeStart: Math.max(0, visibleLines - 1) * lineHeight,
      fadeEnd: Math.max(1, Math.min(innerHeight, Math.max(1, visibleLines) * lineHeight)),
    }];
  })), [board.objects, inline, selectedId, text]);
  const displayedObjects = board.objects.map((o) => ({ ...o, displayHeight: objectLayouts.get(o.id)!.height }));
  const bounds = boundingBox(displayedObjects.filter((o) => selected.has(o.id)));
  const selectedGroups = wholeGroups(displayedObjects, selected);
  const numbers = groupNumbers(board.objects);
  const handlesVisible = !!bounds && tool === "Select" && !readOnly && !inline && !composing &&
    (!busy || !!drag.current?.corner);
  const handlePoints = bounds ? CORNERS.map((corner) => ({
    corner, ...posForCorner(corner, bounds),
  })) : [];
  function posForCorner(corner: Corner, rectangle: Rectangle) {
    return {
      x: rectangle.x + (corner.endsWith("e") ? rectangle.width : 0),
      y: rectangle.y + (corner.startsWith("s") ? rectangle.height : 0),
    };
  }
  const commonStyle = <K extends keyof Style>(key: K): Style[K] | "" => {
    const value = selectedObjects[0]?.[key];
    return value && selectedObjects.every((o) => o[key] === value) ? value : "";
  };
  const selectionColor = commonStyle("color"), selectionSize = commonStyle("textSize"), selectionAlign = commonStyle("align");
  const colourLabel = selectionColor ? colorEntry(selectionColor).label : "Mixed";
  const itemHeight = item ? objectLayouts.get(item.id)!.height : 0;
  const fallbackFocus = useRef(false);
  const boardButton = useRef<HTMLButtonElement>(null),
    navButton = useRef<HTMLButtonElement>(null),
    infoButton = useRef<HTMLButtonElement>(null);
  const layout = usePanelLayout(scene);
  const invalidObjectFields = board.objects.flatMap((o, i) =>
    !validText(drafts[o.id] ?? o.text, 1000)
      ? [
        "Object " + (i + 1) +
        " exceeds 1,000 code points or contains invalid Unicode. Correct it in Objects.",
      ]
      : []
  );
  const invalidObjectText = invalidObjectFields.length > 0;
  const invalidFields = [
    ...(!validText(title, 120, true)
      ? ["Board name requires 1–120 code points and cannot be blank."]
      : []),
    ...invalidObjectFields,
  ];
  const invalid = invalidFields.length > 0;
  const pending = useRef({ invalid: true, composing: false, busy: false });
  pending.current = { invalid, composing, busy };
  const { view, setView, trackPointer } = useViewport({ scene, inlineSurface, inline, drag, pending });
  function select(value: string | Iterable<string>) {
    finishTextSession();
    setInline(false);
    setSwatchFor("");
    setArrangeFor("");
    setSelected(new Set(typeof value === "string" ? value ? [value] : [] : value));
  }
  const { snapshots, alive, adopt, save, reopen } = useStorageSession({
    readOnly, setReadOnly, setStatus, setMessage, load, clearHistory, model,
    revision, adapter, select, setInline, setView, invalid, busy, composing, pending,
  });
  const size = useSceneSize(scene);
  useEffect(() => {
    if (inline && !composing) editor.current?.focus();
  }, [inline, selected]);
  useEffect(() => {
    if (panel === "Objects") {
      if (fallbackFocus.current) {
        fallbackFocus.current = false;
        editor.current?.focus();
      } else selector.current?.focus();
    }
  }, [panel]);
  const pos = (o: { x: number; y: number }) => ({
    left: size.w / 2 + (o.x - view.x) * view.z,
    top: size.h / 2 + (o.y - view.y) * view.z,
  });
  const {
    commitText, changeText, create, movedBoard, move, resizeStart,
    resizeStillValid, resizedBoard, resizeBy,
  } = useGeometryEdits({
    model, commit, beginTextSession, finishTextSession, setDrafts, setMessage,
    item, selected, select, objectLayouts, readOnly, busy, composing,
    setStatus, setTool, setPanel, setInline, editor, lineCount,
  });
  function fallbackEditor() {
    finishTextSession();
    fallbackFocus.current = true;
    setPanel("Objects");
    setInline(false);
  }
  function edit() {
    if (!item || readOnly || busy || composing) return;
    finishTextSession();
    setPanel("");
    setInline(true);
  }
  useEffect(() => {
    if (!inline || !item || composing) return;
    const p = pos(item), rect = editor.current?.getBoundingClientRect();
    const obscured = rect &&
      Array.from(
        document.querySelectorAll(".file,.actions,.palette,.zoom,.notice"),
      ).some((el) => {
        const r = el.getBoundingClientRect();
        return rect.left < r.right && rect.right > r.left &&
          rect.top < r.bottom && rect.bottom > r.top;
      });
    if (
      size.w < 768 || p.left < 0 || p.top < 0 ||
      p.left + item.width * view.z > size.w ||
      p.top + itemHeight * view.z > size.h ||
      (item.width - 40) * view.z < 120 || (itemHeight - 40) * view.z < 60 ||
      textUnits(item.textSize) * view.z < 12 || obscured
    ) fallbackEditor();
  }, [inline, selected, view, size, composing, itemHeight, item?.width, item?.textSize]);
  function toggle(name: string) {
    if (composing || busy) return;
    finishTextSession();
    setInline(false);
    setPanel((p) => p === name ? "" : name);
    if (panel === name) {
      (name === "Objects"
        ? objectsButton
        : name === "Board"
        ? boardButton
        : name === "Information"
        ? infoButton
        : navButton).current?.focus();
    }
  }
  const {
    cancel, sceneKeyDown, pointerDown, pointerMove, pointerUp, doubleClick,
    pointerCancel, lostPointerCapture,
  } = useCanvasInput({
    model, commit, setBoard, clearHistory, finishTextSession, setView, trackPointer,
    setMessage, create, resizeStart, resizeStillValid, resizedBoard, movedBoard,
    scene, view, size, drag, busy, setBusy, spacePanRef, setSpacePan, setSelectionBox,
    selected, select, tool, setTool, readOnly, composing, inline, setInline, setPanel,
    handlesVisible, handlePoints, objectLayouts, displayedObjects, edit,
  });
  const nativeEditor = (
    <>
      <label htmlFor="content">Content</label>
      <textarea
        id="content"
        ref={editor}
        aria-label={inline ? "Edit selected object on canvas" : "Content"}
        value={text}
        readOnly={readOnly || busy}
        disabled={!item}
        onFocus={() => beginTextSession(item)}
        onChange={(e) => changeText(e.target.value)}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={(e) => {
          setComposing(false);
          const value = e.currentTarget.value;
          setDrafts((d) => ({ ...d, [selectedId]: value }));
          if (item && validText(value, 1000) && !readOnly) {
            commitText(selectedId, value);
          }
        }}
        onBlur={() => {
          if (!composing) {
            finishTextSession();
            setInline(false);
          }
        }}
      />
      <small>{count(text)} / 1,000 code points</small>
    </>
  );
  const commandReason = editingCommandReason({ readOnly, composing, pointerGesture: busy, invalidObjectText });
  const session = textSession.current;
  const sessionChanged = !!session &&
    JSON.stringify(session.before.objects.find((o) => o.id === session.id)) !==
      JSON.stringify(model.current.objects.find((o) => o.id === session.id));
  const undoReason = commandReason || (!history.past.length && !sessionChanged ? "Nothing to undo." : "");
  const redoReason = commandReason || (sessionChanged || !history.future.length ? "Nothing to redo." : "");
  const selectionReason = commandReason || (!selected.size ? "Select an object to duplicate or delete." : "");
  const clipboardState = { readOnly, composing, pointerGesture: busy, invalidObjectText };
  const showNotice = !!(visibleMessage || invalid || busy || readOnly ||
    tool === "Sticky" || tool === "Text" || snapshots.length);
  // The context surface follows transformed bounds without changing board geometry.
  const {
    contextWidth, contextLeft, contextTop, contextFits, swatchOpen, arrangeOpen,
    arrangeHeight, setSwatchFor, setArrangeFor, closeSwatches, closeArrange,
  } = useContextBar({
    selectionKey, selected, selectionReason, bounds, pos, view, size, layout, inline,
    item, itemHeight, contextBar, colourControl, colourButton, swatches,
    arrangeControl, arrangeButton, arrangeMenu,
  });
  const editingState = { readOnly, composing, pointerGesture: busy, invalidObjectText };
  const arrangementMembers = displayedObjects.filter((o) => selected.has(o.id));
  const { objectClipboard, command, clipboardCommand, arrangementReason, arrange, changeStyle } = useEditingCommands({
    model, commit, historyRef, updateHistory, setDrafts, finishTextSession,
    setMessage, messageSequence, alive, select, selected, setInline, scene, view,
    displayedObjects, commandReason, selectionReason, clipboardState, editingState,
    arrangementMembers, lineCount,
  });
  const { pageKeyDown } = usePageKeys({
    command, clipboardCommand, model, cancel, scene, busy, composing, select,
    setInline, panel, setPanel, objectsButton, boardButton, infoButton, navButton,
  });

  return (
    <main
      style={{
        "--notice-top": layout.notice + "px",
        "--panel-top": layout.panel + "px",
      } as React.CSSProperties}
      onKeyDown={pageKeyDown}
    >
      <div
        ref={scene}
        className={"scene" + (spacePan ? busy ? " grabbing" : " grab" : "")}
        style={{
          cursor: drag.current?.corner ? (drag.current.corner === "nw" || drag.current.corner === "se"
            ? "nwse-resize" : "nesw-resize") : undefined,
          backgroundSize: `${24 * view.z}px ${24 * view.z}px`,
          backgroundPosition: `${size.w / 2 - view.x * view.z}px ${
            size.h / 2 - view.y * view.z
          }px`,
        }}
        tabIndex={0}
        aria-label="Board canvas. Use Objects to read and edit. Enter places an armed tool or edits the selection."
        onPointerEnter={trackPointer}
        onKeyDown={sceneKeyDown}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onDoubleClick={doubleClick}
        onPointerCancel={pointerCancel}
        onLostPointerCapture={lostPointerCapture}
      >
        <BoardDrawing
          size={size} view={view} board={board} objectLayouts={objectLayouts} selected={selected} inline={inline}
        />
        <Overlays
          selectedGroups={selectedGroups} pos={pos} view={view} handlesVisible={handlesVisible}
          handlePoints={handlePoints} spacePan={spacePan} selectionBox={selectionBox}
        />
      </div>
      <FileBar
        boardButton={boardButton} composing={composing} busy={busy} toggle={toggle} panel={panel}
        title={title} objectsButton={objectsButton} undoReason={undoReason} redoReason={redoReason}
        command={command}
      />
      <SaveArea
        latestAcknowledgement={latestAcknowledgement} status={status} invalid={invalid} save={save}
        readOnly={readOnly} composing={composing} busy={busy}
      />
      <span id="undo-reason" className="sr-only">{undoReason}</span>
      <span id="redo-reason" className="sr-only">{redoReason}</span>
      <span id="selection-reason" className="sr-only">{selectionReason}</span>
      <Notice
        showNotice={showNotice} visibleMessage={visibleMessage} invalidFields={invalidFields}
        busy={busy} tool={tool} readOnly={readOnly} snapshots={snapshots} reopen={reopen}
        composing={composing} adopt={adopt} setReadOnly={setReadOnly} setMessage={setMessage}
      />
      {panel === "Board" && (
        <BoardPanel
          setComposing={setComposing} commit={commit} model={model} title={title} readOnly={readOnly}
          busy={busy} setTitle={setTitle} setStatus={setStatus} composing={composing} reopen={reopen}
          setPanel={setPanel} boardButton={boardButton}
        />
      )}
      {panel === "Objects" && (
        <ObjectsPanel
          board={board} busy={busy} composing={composing} setPanel={setPanel}
          objectsButton={objectsButton} selector={selector} selected={selected}
          finishTextSession={finishTextSession} select={select} numbers={numbers} drafts={drafts}
          nativeEditor={nativeEditor} selectionColor={selectionColor} selectionSize={selectionSize}
          selectionAlign={selectionAlign} selectionReason={selectionReason} changeStyle={changeStyle}
          command={command} readOnly={readOnly} move={move} bounds={bounds} resizeBy={resizeBy}
          arrange={arrange} arrangementReason={arrangementReason} objectClipboard={objectClipboard}
          clipboardState={clipboardState} clipboardCommand={clipboardCommand} create={create} view={view}
        />
      )}
      {selected.size > 0 && (
        <ContextBar
          contextBar={contextBar} contextFits={contextFits} contextLeft={contextLeft}
          contextTop={contextTop} item={item} selected={selected} readOnly={readOnly}
          composing={composing} busy={busy} inline={inline} finishTextSession={finishTextSession}
          setInline={setInline} scene={scene} edit={edit} text={text} colourControl={colourControl}
          colourButton={colourButton} selectionReason={selectionReason} colourLabel={colourLabel}
          swatchOpen={swatchOpen} setArrangeFor={setArrangeFor} setSwatchFor={setSwatchFor}
          selectionKey={selectionKey} selectionColor={selectionColor} swatches={swatches}
          contextWidth={contextWidth} size={size} closeSwatches={closeSwatches} changeStyle={changeStyle}
          selectionSize={selectionSize} selectionAlign={selectionAlign} arrangeControl={arrangeControl}
          arrangeButton={arrangeButton} arrangeOpen={arrangeOpen} arrangeMenu={arrangeMenu}
          arrangeHeight={arrangeHeight} closeArrange={closeArrange} arrange={arrange}
          arrangementReason={arrangementReason} command={command}
        />
      )}
      {inline && item && (
        <InlineEditor
          inlineSurface={inlineSurface} trackPointer={trackPointer} pos={pos} item={item}
          view={view} itemHeight={itemHeight} nativeEditor={nativeEditor}
        />
      )}
      <Palette
        tool={tool} busy={busy} composing={composing} readOnly={readOnly} setTool={setTool}
        setInline={setInline} scene={scene}
      />
      <ZoomControls
        busy={busy} composing={composing} setView={setView} view={view} panel={panel}
        navButton={navButton} toggle={toggle}
      />
      <InformationButton
        infoButton={infoButton} panel={panel} busy={busy} composing={composing} toggle={toggle}
      />
      {panel === "Information" && (
        <InformationPanel
          busy={busy} composing={composing} toggle={toggle}
        />
      )}
      {panel === "Navigation" && (
        <NavigationPanel
          busy={busy} composing={composing} setView={setView} setPanel={setPanel} navButton={navButton}
        />
      )}
    </main>
  );
}
