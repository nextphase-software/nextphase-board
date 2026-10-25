// SPDX-License-Identifier: Apache-2.0
import { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import {
  add,
  type Board as SavedBoard,
  clamp,
  count,
  empty,
  type ItemV3 as Item,
  validText,
} from "./document";
import { colorEntry, textUnits, type Style } from "./styles";
import { decode, LocalStore, readPair } from "./storage";
import { deleteObject, duplicate, redo, undo } from "./history";
import { allowedHeight, displayHeight, neededHeight, savedHeight, TEXT_INSET, TEXT_LAYOUT } from "./geometry";
import { gestureScale, panView, wheelDelta, wheelZoomFactor, zoomView, type View } from "./view";
import { boundingBox, boxSelection, limitMove } from "./selection";
import { editingCommandReason } from "./commands";
import { resizeObject, resizeSet, type Corner, type Rectangle } from "./resize";
import { arrangeOrder, arrangePositions, arrangeReason, isOrderCommand, type ArrangeCommand } from "./arrange";
import { expandSelection, groupNumbers, groupObjects, groupReason, pressSelection, toggleGroup, ungroupObjects, wholeGroups } from "./group";
import { buildPaste, buildSnapshot, clipboardReason, plainText, type ClipboardCommand, type Snapshot } from "./clipboard";

import { useMessages } from "./state/use-messages";
import { useBoardDocument } from "./state/use-board-document";
import { usePanelLayout } from "./state/use-panel-layout";
import { useContextBar } from "./state/use-context-bar";

import { typeForTool } from "./objects/registry";
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
    [view, setView] = useState<View>({ x: 0, y: 0, z: 1 }),
    [size, setSize] = useState({ w: innerWidth, h: innerHeight }),
    [busy, setBusy] = useState(false),
    [spacePan, setSpacePan] = useState(false),
    [composing, setComposing] = useState(false),
    [objectClipboard, setObjectClipboard] = useState<Snapshot | null>(null),
    [snapshots, setSnapshots] = useState<{ board: SavedBoard; revision: number }[]>(
      [],
    );
  const { setMessage, messageSequence, latestAcknowledgement, visibleMessage } = useMessages();
  const {
    board, setBoard, title, setTitle, drafts, setDrafts, history,
    model, historyRef, textSession, revision, adapter,
    updateHistory, clearHistory, beginTextSession, finishTextSession, commit, load,
  } = useBoardDocument({ readOnly, setStatus });
  const ack = useRef(-1),
    store = useRef<LocalStore | null>(null),
    release = useRef<(() => void) | null>(null),
    scene = useRef<HTMLDivElement>(null),
    contextBar = useRef<HTMLElement>(null),
    colourControl = useRef<HTMLSpanElement>(null),
    colourButton = useRef<HTMLButtonElement>(null),
    swatches = useRef<HTMLDivElement>(null),
    arrangeControl = useRef<HTMLSpanElement>(null),
    arrangeButton = useRef<HTMLButtonElement>(null),
    arrangeMenu = useRef<HTMLDivElement>(null),
    inlineSurface = useRef<HTMLElement>(null),
    spacePanRef = useRef(false),
    lastPointer = useRef<{ x: number; y: number } | null>(null),
    previousScale = useRef(1),
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
    >(null),
    alive = useRef(true);
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
  const lockTask = useRef<Promise<void> | null>(null),
    fallbackFocus = useRef(false);
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
  function select(value: string | Iterable<string>) {
    finishTextSession();
    setInline(false);
    setSwatchFor("");
    setArrangeFor("");
    setSelected(new Set(typeof value === "string" ? value ? [value] : [] : value));
  }
  function adopt(input: SavedBoard, saved: boolean) {
    load(input);
    select("");
    setInline(false);
    setView({ x: 0, y: 0, z: 1 });
    ack.current = saved ? 0 : -1;
    setStatus(saved ? "Locally saved" : "Unsaved");
  }
  async function start() {
    if (release.current || store.current) return;
    clearHistory();
    setReadOnly(true);
    setMessage("Checking local storage and writer ownership…");
    let own = false;
    let writerReason = "Another tab is editing. This board is read-only.";
    try {
      if (!navigator.locks) {
        writerReason = "Web Locks unavailable. This board is read-only; editing is disabled.";
      } else try {
        await new Promise<void>((resolve, reject) => {
        lockTask.current = navigator.locks.request(
          "nextphase-board/writer/v1",
          { mode: "exclusive", ifAvailable: true },
          async (lock) => {
            own = !!lock;
            if (!lock) {
              resolve();
              return;
            }
            await new Promise<void>((done) => {
              release.current = done;
              resolve();
            });
          },
        ).catch(reject);
        });
      } catch (error) {
        writerReason = "Writer ownership unavailable. This board is read-only. " + String(error);
      }
      const s = new LocalStore();
      store.current = s;
      const pair = await s.open(() => {
        clearHistory();
        setReadOnly(true);
        setMessage("Storage version changed. Reload explicitly to retry.");
        release.current?.();
        release.current = null;
      });
      try {
        const loaded = await readPair(pair);
        if (!alive.current) return;
        adopt(loaded?.board ?? empty(), !!loaded);
        setReadOnly(!own);
        setMessage(
          own
            ? "Stored only in this browser profile. Browser storage is not a backup."
            : writerReason,
        );
      } catch (error) {
        const valid = [];
        for (const raw of pair) {
          try {
            const x = await decode(raw);
            valid.push({
              board: x.board,
              revision: x.envelope.storageRevision,
            });
          } catch {}
        }
        setSnapshots(valid);
        setReadOnly(true);
        setMessage(
          "Saved data is unsupported, damaged or inconsistent. Original records are preserved. " +
            String(error),
        );
      }
    } catch (error) {
      setReadOnly(true);
      setMessage("Storage unavailable. " + String(error));
    }
  }
  useEffect(() => {
    alive.current = true;
    void start();
    const resize = () =>
      setSize({
        w: scene.current?.clientWidth ?? innerWidth,
        h: scene.current?.clientHeight ?? innerHeight,
      });
    resize();
    window.addEventListener("resize", resize);
    const hide = () => {
      clearHistory();
      store.current?.close();
      store.current = null;
      release.current?.();
      release.current = null;
      setReadOnly(true);
    };
    const show = () => {
      if (!store.current) {
        setMessage(
          "Editing paused. Retry editing to reacquire ownership and reload.",
        );
      }
    };
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      alive.current = false;
      hide();
      adapter.current?.destroy();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    };
  }, []);
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
  function commitText(id: string, value: string) {
    commit({
      ...model.current,
      objects: model.current.objects.map((o) =>
        o.id === id && o.text !== value
          ? { ...o, text: value, height: savedHeight(o, lineCount(o, value), textUnits(o.textSize)) }
          : o
      ),
    });
  }
  function changeText(value: string) {
    if (!item || readOnly) return;
    beginTextSession(item);
    setDrafts((d) => ({ ...d, [item.id]: value }));
    setStatus("Unsaved");
    if (validText(value, 1000) && !composing) {
      commitText(item.id, value);
    }
  }
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
  function create(type: Item["type"], x: number, y: number, native = false) {
    if (readOnly || busy || composing) return;
    try {
      const next = add(model.current, type, x, y);
      commit(next, true);
      select(next.objects.at(-1)!.id);
      setTool("Select");
      setPanel(native ? "Objects" : "");
      setInline(!native);
      if (native) setTimeout(() => editor.current?.focus(), 0);
    } catch (e) {
      setMessage(String(e));
    }
  }
  function save() {
    if (invalid || readOnly || busy || composing || !store.current) return;
    const captured = revision.current;
    setStatus("Saving");
    store.current.save(model.current, captured).then((receipt) => {
      ack.current = receipt.draftRevision;
      setStatus(
        revision.current === captured && !pending.current.invalid &&
          !pending.current.composing && !pending.current.busy
          ? "Locally saved"
          : "Unsaved",
      );
      setMessage(
        "Local revision " + receipt.storageRevision +
          " acknowledged after transaction completion.",
      );
    }).catch((error) => {
      setStatus("Save failed");
      setMessage(String(error));
      if (String(error).includes("changed")) {
        clearHistory();
        setReadOnly(true);
      }
    });
  }
  async function reopen() {
    if (composing || busy) return;
    if (
      (revision.current !== ack.current || invalid) &&
      !confirm("Discard unsaved drafts and reload the saved board?")
    ) return;
    clearHistory();
    store.current?.close();
    store.current = null;
    release.current?.();
    release.current = null;
    await lockTask.current;
    setSnapshots([]);
    await start();
  }
  function movedBoard(ids: string[], dx: number, dy: number) {
    const members = model.current.objects.filter((o) => ids.includes(o.id));
    const delta = limitMove(members, { x: dx, y: dy });
    return { ...model.current, objects: model.current.objects.map((o) => ids.includes(o.id)
      ? { ...o, x: o.x + delta.x, y: o.y + delta.y } : o) };
  }
  function move(dx: number, dy: number) {
    if (!selected.size || readOnly || composing || busy) return;
    commit(movedBoard([...selected], dx, dy), true);
  }
  function resizeStart(): ResizeStart[] {
    return model.current.objects.filter((o) => selected.has(o.id)).map((object) => ({
      object, rectangle: { x: object.x, y: object.y, width: object.width,
        height: objectLayouts.get(object.id)!.height },
    }));
  }
  function resizeStillValid(start: ResizeStart[]) {
    return start.every(({ object }) => {
      const live = model.current.objects.find((o) => o.id === object.id);
      return live && live.generation === object.generation && live.x === object.x &&
        live.y === object.y && live.width === object.width && live.height === object.height;
    });
  }
  function resizedBoard(corner: Corner, start: ResizeStart[], dx: number, dy: number, shift: boolean) {
    const members = start.map(({ object, rectangle }) => ({ ...rectangle,
      neededHeight: (width: number) => neededHeight(lineCount({ ...object, width }), textUnits(object.textSize)),
    }));
    const geometry = members.length === 1
      ? [resizeObject(corner, start[0].rectangle, { x: dx, y: dy }, shift, members[0].neededHeight)]
      : resizeSet(corner, members, { x: dx, y: dy }, shift);
    // Starting drawn heights may exceed saved heights. An unchanged resize saves nothing.
    if (geometry.every((g, i) => Object.keys(g).every((key) =>
      g[key as keyof Rectangle] === start[i].rectangle[key as keyof Rectangle]))) return model.current;
    const changes = new Map(start.map(({ object }, i) => [object.id, geometry[i]]));
    return { ...model.current, objects: model.current.objects.map((o) =>
      changes.has(o.id) ? { ...o, ...changes.get(o.id)! } : o) };
  }
  function resizeBy(dx: number, dy: number) {
    if (!selected.size || readOnly || composing || busy) return;
    finishTextSession();
    commit(resizedBoard("se", resizeStart(), dx, dy, false), true);
  }
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
  function point(e: { clientX: number; clientY: number }) {
    const r = scene.current!.getBoundingClientRect();
    return {
      x: view.x + (e.clientX - r.left - size.w / 2) / view.z,
      y: view.y + (e.clientY - r.top - size.h / 2) / view.z,
    };
  }
  function trackPointer(e: React.PointerEvent) {
    const r = scene.current!.getBoundingClientRect();
    lastPointer.current = { x: e.clientX - r.left, y: e.clientY - r.top };
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
  useEffect(() => {
    clearHistory();
    if (readOnly) cancel();
  }, [readOnly]);
  const commandReason = editingCommandReason({ readOnly, composing, pointerGesture: busy, invalidObjectText });
  const session = textSession.current;
  const sessionChanged = !!session &&
    JSON.stringify(session.before.objects.find((o) => o.id === session.id)) !==
      JSON.stringify(model.current.objects.find((o) => o.id === session.id));
  const undoReason = commandReason || (!history.past.length && !sessionChanged ? "Nothing to undo." : "");
  const redoReason = commandReason || (sessionChanged || !history.future.length ? "Nothing to redo." : "");
  const selectionReason = commandReason || (!selected.size ? "Select an object to duplicate or delete." : "");
  const clipboardState = { readOnly, composing, pointerGesture: busy, invalidObjectText };
  function writePlainText(snapshot: Snapshot, copiedMessage: string) {
    const sequence = messageSequence.current;
    const failed = () => {
      if (alive.current && sequence === messageSequence.current) {
        setMessage(copiedMessage + " Text could not be placed on the system clipboard.");
      }
    };
    try {
      // Start in the command's event handler, while transient activation exists.
      if (!navigator.clipboard?.writeText) failed();
      else void navigator.clipboard.writeText(plainText(snapshot)).catch(failed);
    } catch { failed(); }
  }
  function clipboardCommand(name: ClipboardCommand) {
    const reason = clipboardReason(name, selected, objectClipboard, clipboardState);
    if (reason) { setMessage(reason); return; }
    try {
      if (name === "Paste") {
        const result = buildPaste(model.current, objectClipboard!, {
          centerX: view.x, centerY: view.y, zoom: view.z,
          width: scene.current!.clientWidth, height: scene.current!.clientHeight,
        });
        const ids = result.board.objects.slice(model.current.objects.length).map((o) => o.id);
        commit(result.board, true);
        select(ids);
        setObjectClipboard({ ...objectClipboard!, pasteCount: result.pasteCount });
        setMessage("Pasted " + ids.length + (ids.length === 1 ? " object." : " objects."));
      } else {
        const snapshot = buildSnapshot(model.current, selected, displayedObjects)!;
        const copiedMessage = name === "Cut" ? command("Cut")
          : "Copied " + snapshot.objects.length + (snapshot.objects.length === 1 ? " object." : " objects.");
        // Delete can refuse (for example at the retired-generation limit).
        if (!copiedMessage) return;
        setObjectClipboard(snapshot);
        if (name === "Copy") setMessage(copiedMessage);
        writePlainText(snapshot, copiedMessage);
      }
    } catch (error) { setMessage(String(error)); }
  }
  function command(name: "Undo" | "Redo" | "Duplicate" | "Delete" | "Cut") {
    if (commandReason) {
      setMessage(commandReason);
      return;
    }
    finishTextSession();
    try {
      const deleting = name === "Delete" || name === "Cut";
      const targets = model.current.objects.filter((o) => selected.has(o.id));
      const current = targets[0];
      if ((name === "Duplicate" || deleting) && !current) {
        setMessage("Select an object to " + name.toLowerCase() + ".");
        return;
      }
      const result = name === "Undo" ? undo(model.current, historyRef.current)
        : name === "Redo" ? redo(model.current, historyRef.current)
        : name === "Duplicate" ? duplicate(model.current, historyRef.current, targets)
        : deleteObject(model.current, historyRef.current, targets);
      const affected = result.board.objects.filter((o) => result.affectedIds.includes(o.id));
      commit(result.board);
      updateHistory(result.history);
      setDrafts((d) => {
        const next = { ...d };
        for (const id of result.affectedIds) delete next[id];
        return next;
      });
      // A history command closes the previous editing route without moving its focus.
      setInline(false);
      const remaining = [...selected].filter((id) => !result.affectedIds.includes(id));
      const removedSelection = remaining.length < selected.size;
      if (affected.length) select(affected.map((o) => o.id));
      else if (removedSelection || deleting) {
        select(deleting ? [] : remaining);
        if (deleting || !remaining.length) scene.current?.focus();
      }
      const label = current
        ? current.type + " " + (current.order + 1) + " · " + (current.text.slice(0, 36) || "Empty")
        : "object";
      const resultMessage = deleting ? (targets.length > 1
        ? (name === "Cut" ? "Cut " : "Deleted ") + targets.length + " objects. Undo restores them."
        : (name === "Cut" ? "Cut " : "Deleted ") + label + ". Undo restores it.")
        : name === "Duplicate" ? (targets.length > 1
          ? "Duplicated " + targets.length + " objects. Copies selected."
          : "Duplicated " + label + ". Copy selected.")
        : name + " complete. " + (affected.length > 1 ? affected.length + " affected objects selected."
          : affected.length ? "Affected object selected."
          : removedSelection ? remaining.length ? "Removed objects deselected." : "Selection cleared."
          : "Selection unchanged.");
      setMessage(resultMessage);
      return resultMessage;
    } catch (error) {
      setMessage(String(error));
    }
  }
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
  function arrangementReason(name: ArrangeCommand) {
    return name === "Group" || name === "Ungroup"
      ? groupReason(name, model.current, selected, editingState)
      : arrangeReason(name, arrangementMembers, editingState);
  }
  function arrange(name: ArrangeCommand) {
    if (arrangementReason(name)) return;
    finishTextSession();
    setInline(false);
    const current = model.current;
    if (name === "Group" || name === "Ungroup") {
      commit(name === "Group" ? groupObjects(current, selected) : ungroupObjects(current, selected), true);
    } else if (isOrderCommand(name)) {
      commit({ ...current, objects: arrangeOrder(name, current.objects, selected) }, true,
        current.objects.filter((o) => selected.has(o.id)).map((o) => o.id));
    } else {
      const positions = new Map(arrangePositions(name, arrangementMembers).map((p) => [p.id, p]));
      commit({ ...current, objects: current.objects.map((o) => positions.has(o.id)
        ? { ...o, x: positions.get(o.id)!.x, y: positions.get(o.id)!.y } : o) }, true);
    }
  }
  function changeStyle<K extends keyof Style>(key: K, value: Style[K]) {
    if (selectionReason) return;
    finishTextSession();
    setInline(false);
    const objects = model.current.objects.map((current) => {
      if (!selected.has(current.id) || current[key] === value) return current;
      const styled = { ...current, [key]: value };
      return key === "textSize"
        ? { ...styled, height: savedHeight(styled, lineCount(styled), textUnits(styled.textSize)) }
        : styled;
    });
    commit({ ...model.current, objects }, true);
  }

  return (
    <main
      style={{
        "--notice-top": layout.notice + "px",
        "--panel-top": layout.panel + "px",
      } as React.CSSProperties}
      onKeyDown={(e) => {
        const nativeText = e.target instanceof Element &&
          !!e.target.closest("input,textarea,[contenteditable]:not([contenteditable=false])");
        if (!nativeText && (e.ctrlKey || e.metaKey) && !e.altKey) {
          const key = e.key.toLowerCase();
          if (key === "z" || (key === "y" && e.ctrlKey && !e.metaKey && !e.shiftKey)) {
            e.preventDefault();
            command(key === "y" || e.shiftKey ? "Redo" : "Undo");
            return;
          }
          if (key === "a" && !e.shiftKey && e.target === scene.current) {
            if (!busy && !composing && model.current.objects.length) {
              e.preventDefault();
              select(model.current.objects.map((o) => o.id));
            }
            return;
          }
          if (key === "d" && !e.shiftKey && e.target === scene.current) {
            e.preventDefault();
            command("Duplicate");
            return;
          }
          if ((key === "c" || key === "x" || key === "v") && !e.shiftKey && e.target === scene.current) {
            e.preventDefault();
            clipboardCommand(key === "c" ? "Copy" : key === "x" ? "Cut" : "Paste");
            return;
          }
        }
        if (e.target === scene.current && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey &&
          (e.key === "Delete" || e.key === "Backspace")) {
          e.preventDefault();
          command("Delete");
          return;
        }
        if (
          e.key !== "Escape" || composing ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) return;
        cancel();
        setInline(false);
        if (panel) {
          setPanel("");
          (panel === "Objects"
            ? objectsButton
            : panel === "Board"
            ? boardButton
            : panel === "Information"
            ? infoButton
            : navButton).current?.focus();
        }
      }}
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
        onKeyDown={(e) => {
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
        }}
        onPointerDown={(e) => {
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
        }}
        onPointerMove={(e) => {
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
        }}
        onPointerUp={(e) => {
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
        }}
        onDoubleClick={(e) => {
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
        }}
        onPointerCancel={() => {
          const d = drag.current;
          if (d?.pan) setView(d.view);
          cancel();
        }}
        onLostPointerCapture={() => {
          if (drag.current) {
            const d = drag.current;
            if (d.pan) setView(d.view);
            cancel();
          }
        }}
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
