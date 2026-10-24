// SPDX-License-Identifier: Apache-2.0
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Group, Layer, Rect, Stage, Text } from "react-konva";
import {
  Adapter,
  add,
  type Board as SavedBoard,
  type BoardV3 as Board,
  clamp,
  count,
  empty,
  type ItemV3 as Item,
  upgrade,
  validText,
} from "./document";
import { ALIGNMENTS, COLORS, TEXT_SIZES, colorEntry, textColor, textUnits, type Style } from "./styles";
import { decode, LocalStore, readPair } from "./storage";
import { Icon } from "./icons";
import { deleteObject, duplicate, emptyHistory, record, redo, undo, type History } from "./history";
import { allowedHeight, displayHeight, neededHeight, savedHeight, TEXT_INSET, TEXT_LAYOUT } from "./geometry";
import { gestureScale, panView, stepZoom, wheelDelta, wheelZoomFactor, zoomView, type View } from "./view";
import { boundingBox, boxSelection, limitMove } from "./selection";
import { editingCommandReason } from "./commands";
import { resizeObject, resizeSet, type Corner, type Rectangle } from "./resize";
import { ARRANGE_GROUPS, arrangeOrder, arrangePositions, arrangeReason, isOrderCommand, type ArrangeCommand } from "./arrange";
import { expandSelection, groupNumbers, groupObjects, groupReason, pressSelection, toggleGroup, ungroupObjects, wholeGroups } from "./group";

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
  const [board, setBoard] = useState<Board>(empty),
    [title, setTitle] = useState(""),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [selected, setSelected] = useState<Set<string>>(() => new Set()),
    [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null),
    [tool, setTool] = useState("Select"),
    [panel, setPanel] = useState(""),
    [inline, setInline] = useState(false),
    [swatchFor, setSwatchFor] = useState(""),
    [arrangeFor, setArrangeFor] = useState(""),
    [arrangeHeight, setArrangeHeight] = useState(0),
    [contextWidth, setContextWidth] = useState(0),
    [readOnly, setReadOnly] = useState(true),
    [message, setMessage] = useState("Opening local board…"),
    [status, setStatus] = useState("Unsaved"),
    [view, setView] = useState<View>({ x: 0, y: 0, z: 1 }),
    [size, setSize] = useState({ w: innerWidth, h: innerHeight }),
    [busy, setBusy] = useState(false),
    [spacePan, setSpacePan] = useState(false),
    [composing, setComposing] = useState(false),
    [history, setHistory] = useState<History>(emptyHistory),
    [snapshots, setSnapshots] = useState<{ board: SavedBoard; revision: number }[]>(
      [],
    );
  const model = useRef(board),
    historyRef = useRef<History>(history),
    textSession = useRef<{ before: Board; id: string } | null>(null),
    revision = useRef(0),
    ack = useRef(-1),
    store = useRef<LocalStore | null>(null),
    adapter = useRef<Adapter | null>(null),
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
  if (!adapter.current) adapter.current = new Adapter();
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
  const [layout, setLayout] = useState({ notice: 80, panel: 130 });
  useEffect(() => {
    const file = document.querySelector(".file")!,
      actions = document.querySelector(".actions")!,
      notice = document.querySelector<HTMLElement>(".notice")!;
    const update = () => {
      const top = scene.current?.getBoundingClientRect().top ?? 0;
      const n = Math.max(
        file.getBoundingClientRect().bottom,
        actions.getBoundingClientRect().bottom,
      ) - top + 8;
      setLayout({
        notice: n,
        panel: n + (notice.hidden ? 0 : notice.getBoundingClientRect().height + 8),
      });
    };
    const observer = new ResizeObserver(update);
    [file, actions, notice].forEach((el) => observer.observe(el));
    update();
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
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
  function updateHistory(next: History) {
    historyRef.current = next;
    setHistory(next);
  }
  function select(value: string | Iterable<string>) {
    finishTextSession();
    setInline(false);
    setSwatchFor("");
    setArrangeFor("");
    setSelected(new Set(typeof value === "string" ? value ? [value] : [] : value));
  }
  function clearHistory() {
    textSession.current = null;
    updateHistory(emptyHistory());
  }
  function beginTextSession() {
    if (!item || readOnly || textSession.current?.id === item.id) return;
    finishTextSession();
    textSession.current = { before: model.current, id: item.id };
  }
  function finishTextSession() {
    const session = textSession.current;
    textSession.current = null;
    if (session) updateHistory(record(historyRef.current, session.before, model.current));
  }
  function commit(input: SavedBoard, recordObject = false, orderIds?: readonly string[]) {
    const next = upgrade(input);
    if (readOnly) return;
    if (JSON.stringify(next) === JSON.stringify(model.current)) return;
    if (recordObject) {
      finishTextSession();
      updateHistory(record(historyRef.current, model.current, next, orderIds));
    }
    model.current = next;
    adapter.current!.set(next);
    revision.current++;
    setBoard(next);
    setStatus("Unsaved");
  }
  function adopt(input: SavedBoard, saved: boolean) {
    const b = upgrade(input);
    clearHistory();
    model.current = b;
    setBoard(b);
    adapter.current?.destroy();
    adapter.current = new Adapter();
    adapter.current.set(b);
    setTitle(b.title);
    setDrafts({});
    select("");
    setInline(false);
    setView({ x: 0, y: 0, z: 1 });
    revision.current = 0;
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
    beginTextSession();
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
        onFocus={beginTextSession}
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
  function command(name: "Undo" | "Redo" | "Duplicate" | "Delete") {
    if (commandReason) {
      setMessage(commandReason);
      return;
    }
    finishTextSession();
    try {
      const targets = model.current.objects.filter((o) => selected.has(o.id));
      const current = targets[0];
      if ((name === "Duplicate" || name === "Delete") && !current) {
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
      else if (removedSelection || name === "Delete") {
        select(name === "Delete" ? [] : remaining);
        if (name === "Delete" || !remaining.length) scene.current?.focus();
      }
      const label = current
        ? current.type + " " + (current.order + 1) + " · " + (current.text.slice(0, 36) || "Empty")
        : "object";
      setMessage(name === "Delete" ? (targets.length > 1
        ? "Deleted " + targets.length + " objects. Undo restores them."
        : "Deleted " + label + ". Undo restores it.")
        : name === "Duplicate" ? (targets.length > 1
          ? "Duplicated " + targets.length + " objects. Copies selected."
          : "Duplicated " + label + ". Copy selected.")
        : name + " complete. " + (affected.length > 1 ? affected.length + " affected objects selected."
          : affected.length ? "Affected object selected."
          : removedSelection ? remaining.length ? "Removed objects deselected." : "Selection cleared."
          : "Selection unchanged."));
    } catch (error) {
      setMessage(String(error));
    }
  }
  const acknowledgement = /^Local revision \d+ acknowledged after transaction completion\.$/.test(message);
  const latestAcknowledgement = useRef("");
  if (acknowledgement) latestAcknowledgement.current = message;
  const routineStorage = message === "Stored only in this browser profile. Browser storage is not a backup.";
  const visibleMessage = acknowledgement || routineStorage ? "" : message;
  const showNotice = !!(visibleMessage || invalid || busy || readOnly ||
    tool === "Sticky" || tool === "Text" || snapshots.length);
  // The context surface follows transformed bounds without changing board geometry.
  useLayoutEffect(() => {
    const bar = contextBar.current;
    if (!bar) return;
    const measure = () => setContextWidth(bar.getBoundingClientRect().width);
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    measure();
    return () => observer.disconnect();
  }, [selectionKey]);
  const contextLeft = bounds
    ? clamp(pos(bounds).left + bounds.width * view.z / 2 - contextWidth / 2,
      12, Math.max(12, size.w - contextWidth - 12)) : 12;
  const contextAbove = bounds ? pos(bounds).top - 48 : 0;
  const contextBelow = bounds ? pos(bounds).top + bounds.height * view.z + 8 : 0;
  const contextTop = clamp(contextAbove >= layout.panel ? contextAbove : contextBelow,
    layout.panel, Math.max(layout.panel, size.h - 52));
  const overlapsEditor = inline && item &&
    contextTop < pos(item).top + (itemHeight - 20) * view.z &&
    contextTop + 40 > pos(item).top + 20 * view.z &&
    contextLeft < pos(item).left + (item.width - 20) * view.z &&
    contextLeft + contextWidth > pos(item).left + 20 * view.z;
  const contextFits = size.w >= 768 && contextWidth > 0 && contextWidth <= size.w - 24 &&
    contextTop + 40 <= size.h - 12 && !overlapsEditor;
  const swatchOpen = swatchFor === selectionKey && selected.size > 0 && contextFits && !selectionReason;
  useEffect(() => {
    if (!swatchOpen) setSwatchFor("");
  }, [swatchOpen, selectionKey]);
  useEffect(() => {
    if (!swatchOpen) return;
    (swatches.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ??
      swatches.current?.querySelector<HTMLButtonElement>("button"))?.focus();
    const outside = (event: Event) => {
      if (event.target instanceof Node && !colourControl.current?.contains(event.target)) {
        setSwatchFor("");
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
    };
  }, [swatchOpen]);
  const arrangeOpen = arrangeFor === selectionKey && selected.size > 0 && contextFits && !selectionReason;
  useEffect(() => {
    if (!arrangeOpen) setArrangeFor("");
  }, [arrangeOpen, selectionKey]);
  useLayoutEffect(() => {
    if (!arrangeOpen || !arrangeMenu.current) return;
    const menu = arrangeMenu.current;
    const measure = () => setArrangeHeight(menu.getBoundingClientRect().height);
    const observer = new ResizeObserver(measure);
    observer.observe(menu);
    measure();
    return () => observer.disconnect();
  }, [arrangeOpen]);
  useEffect(() => {
    if (!arrangeOpen) return;
    arrangeMenu.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const outside = (event: Event) => {
      if (event.target instanceof Node && !arrangeControl.current?.contains(event.target)) {
        setArrangeFor("");
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
    };
  }, [arrangeOpen]);
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
  function closeArrange() {
    setArrangeFor("");
    arrangeButton.current?.focus();
  }
  function arrangementControls(prefix: string, choose: (name: ArrangeCommand) => void) {
    return ARRANGE_GROUPS.map((group) => <div key={group.label} className="arrange-group"
      role="group" aria-label={group.label}>
      <h3>{group.label}</h3>
      {group.commands.map((name) => {
        const reason = arrangementReason(name);
        const description = prefix + "-" + name.replaceAll(" ", "-");
        return <span key={name}>
          <button disabled={!!reason} title={reason || name}
            aria-describedby={reason ? description : undefined}
            onClick={(e) => { e.currentTarget.focus(); choose(name); }}>{name}</button>
          {reason && <span className="sr-only" id={description}>{reason}</span>}
        </span>;
      })}
    </div>);
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

  function closeSwatches() {
    setSwatchFor("");
    colourButton.current?.focus();
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
                tool === "Sticky" ? "sticky" : "text",
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
                  d.id === "Sticky" ? "sticky" : "text",
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
        <Stage width={size.w} height={size.h} listening={false}>
          <Layer
            x={size.w / 2 - view.x * view.z}
            y={size.h / 2 - view.y * view.z}
            scaleX={view.z}
            scaleY={view.z}
          >
            {board.objects.map((o) => {
              const layout = objectLayouts.get(o.id)!;
              return (
                <Group key={o.id}>
                  <Rect
                    x={o.x}
                    y={o.y}
                    width={o.width}
                    height={layout.height}
                    fill={o.type === "sticky" ? colorEntry(o.color).fill : undefined}
                    stroke={selected.has(o.id)
                      ? "#518de0"
                      : o.type === "sticky"
                      ? colorEntry(o.color).edge
                      : undefined}
                    strokeWidth={selected.has(o.id) ? 2 / view.z : 1}
                  />
                  {!(inline && selected.has(o.id)) && layout.height > 2 * TEXT_INSET &&
                    o.width > 2 * TEXT_INSET && (
                    <Group
                      clipX={o.x + TEXT_INSET}
                      clipY={o.y + TEXT_INSET}
                      clipWidth={o.width - 2 * TEXT_INSET}
                      clipHeight={layout.height - 2 * TEXT_INSET}
                    >
                      <Text
                        {...TEXT_LAYOUT}
                        fontSize={textUnits(o.textSize)}
                        align={o.align}
                        x={o.x + TEXT_INSET}
                        y={o.y + TEXT_INSET}
                        width={o.width - 2 * TEXT_INSET}
                        height={layout.height - 2 * TEXT_INSET}
                        text={o.text}
                        fill={textColor(o)}
                        fillPriority={layout.limited ? "linear-gradient" : "color"}
                        fillLinearGradientStartPoint={{ x: 0, y: layout.fadeStart }}
                        fillLinearGradientEndPoint={{ x: 0, y: layout.fadeEnd }}
                        fillLinearGradientColorStops={[0, textColor(o), 1, textColor(o) + "00"]}
                      />
                    </Group>
                  )}
                </Group>
              );
            })}
          </Layer>
        </Stage>
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
        {selectionBox && <div className="selection-box" aria-hidden="true" style={{
          left: pos(selectionBox).left, top: pos(selectionBox).top,
          width: selectionBox.width * view.z, height: selectionBox.height * view.z,
        }} />}
      </div>
      <section className="file floating">
        <button
          ref={boardButton}
          disabled={composing || busy}
          onClick={() => toggle("Board")}
          aria-expanded={panel === "Board"}
        >
          <b className="brand" aria-hidden="true">N</b>
          <span className="board-title">{title || "Untitled board"}</span>
          <Icon name="chevron" />
        </button>
        <small>Local</small>
        <span className="divider" aria-hidden="true" />
        <button
          className="icon-button"
          ref={objectsButton}
          onClick={() => toggle("Objects")}
          aria-label="Objects"
          aria-expanded={panel === "Objects"}
          disabled={composing || busy}
        >
          <Icon name="objects" /><span className="tooltip">Objects</span>
        </button>
        {(["Undo", "Redo"] as const).map((name) => (
          <button
            key={name}
            className="icon-button"
            aria-label={name}
            aria-describedby={name === "Undo" ? "undo-reason" : "redo-reason"}
            aria-disabled={!!(name === "Undo" ? undoReason : redoReason)}
            onClick={() => command(name)}
          >
            <Icon name={name} /><span className="tooltip">{(name === "Undo" ? undoReason : redoReason) || name}</span>
          </button>
        ))}
      </section>
      <section className="actions floating" aria-describedby={latestAcknowledgement.current ? "save-acknowledgement" : undefined}>
        <span className="save-status" role="status">
          <Icon name="status" />{status}{invalid ? " · Invalid draft" : ""}
        </span>
        <span id="save-acknowledgement" className="sr-only">{latestAcknowledgement.current}</span>
        <button
          className={status === "Save failed" ? "error" : status === "Unsaved" ? "primary" : ""}
          onClick={save}
          disabled={readOnly || invalid || composing || busy}
        >
          {status === "Save failed" ? "Retry save" : "Save"}
        </button>
      </section>
      <span id="undo-reason" className="sr-only">{undoReason}</span>
      <span id="redo-reason" className="sr-only">{redoReason}</span>
      <span id="selection-reason" className="sr-only">{selectionReason}</span>
      <aside className="notice" role="status" hidden={!showNotice}>
        {visibleMessage}
        {invalidFields.map((s) => <div key={s}>{s}</div>)}
        {busy && (
          <div>
            Gesture in progress. Save, selection and view controls are paused
            until release or cancellation.
          </div>
        )}
        {(tool === "Sticky" || tool === "Text") && (
          <div>
            Click empty canvas or press Enter to place one {tool.toLowerCase()}
            {" "}
            object. Escape cancels.
          </div>
        )}
        {readOnly && !snapshots.length && (
          <button onClick={reopen}>Retry editing</button>
        )}
        {snapshots.map((s) => (
          <button
            key={s.revision}
            disabled={busy || composing}
            onClick={() => {
              adopt(s.board, true);
              setReadOnly(true);
              setMessage(
                "Viewing valid snapshot revision " + s.revision +
                  " · read-only. Original saved records are preserved.",
              );
            }}
          >
            View valid snapshot {s.revision}
          </button>
        ))}
      </aside>
      {panel === "Board" && (
        <section className="details floating">
          <label htmlFor="title">Board name</label>
          <input
            id="title"
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={(e) => {
              setComposing(false);
              if (validText(e.currentTarget.value, 120, true)) {
                commit({ ...model.current, title: e.currentTarget.value });
              }
            }}
            value={title}
            readOnly={readOnly || busy}
            onChange={(e) => {
              const value = e.target.value;
              setTitle(value);
              setStatus("Unsaved");
              if (validText(value, 120, true) && !composing) {
                commit({ ...model.current, title: value });
              }
            }}
          />
          <small>{count(title)} / 120 · nonblank name required</small>
          <button onClick={reopen} disabled={busy || composing}>Reopen</button>
          <p>
            One board in this browser origin/profile. Browser storage is not a
            backup.
          </p>
          <button
            disabled={composing || busy}
            onClick={() => {
              setPanel("");
              boardButton.current?.focus();
            }}
          >
            Close board details
          </button>
        </section>
      )}
      {panel === "Objects" && (
        <section
          className="objects floating"
          aria-label="Objects and keyboard editing"
        >
          <header>
            <h2>Objects {board.objects.length} / 250</h2>
            <button
              disabled={busy || composing}
              onClick={() => {
                setPanel("");
                objectsButton.current?.focus();
              }}
            >
              Close
            </button>
          </header>
          <label htmlFor="selection">Selected objects</label>
          <select
            disabled={composing || busy}
            ref={selector}
            id="selection"
            multiple
            size={5}
            value={[...selected]}
            onChange={(e) => {
              finishTextSession();
              select(Array.from(e.currentTarget.selectedOptions, (o) => o.value));
            }}
          >
            {board.objects.map((o, i) => (
              <option key={o.id} value={o.id}>
                {o.type} {i + 1}{o.group !== null ? " · Group " + numbers.get(o.group) : ""} ·{" "}
                {(drafts[o.id] ?? o.text).slice(0, 36) || "Empty"}
              </option>
            ))}
          </select>
          {selected.size > 1 ? <p>{selected.size} objects selected</p> : nativeEditor}
          {selected.size > 0 && <div className="object-styles">
            <label htmlFor="object-colour">Colour</label>
            <select id="object-colour" value={selectionColor} disabled={!!selectionReason}
              title={selectionReason || "Colour"} aria-describedby="selection-reason"
              onChange={(e) => changeStyle("color", e.target.value as Style["color"])}>
              {!selectionColor && <option value="" disabled>Mixed</option>}
              {COLORS.map((c) => <option key={c.name} value={c.name}>{c.label}</option>)}
            </select>
            <label htmlFor="object-size">Text size</label>
            <select id="object-size" value={selectionSize} disabled={!!selectionReason}
              title={selectionReason || "Text size"} aria-describedby="selection-reason"
              onChange={(e) => changeStyle("textSize", e.target.value as Style["textSize"])}>
              {!selectionSize && <option value="" disabled>Mixed</option>}
              {TEXT_SIZES.map((s) => <option key={s.name} value={s.name}>{s.label}</option>)}
            </select>
            <label htmlFor="object-align">Alignment</label>
            <select id="object-align" value={selectionAlign} disabled={!!selectionReason}
              title={selectionReason || "Alignment"} aria-describedby="selection-reason"
              onChange={(e) => changeStyle("align", e.target.value as Style["align"])}>
              {!selectionAlign && <option value="" disabled>Mixed</option>}
              {ALIGNMENTS.map((a) => <option key={a.name} value={a.name}>{a.label}</option>)}
            </select>
          </div>}
          <div className="object-commands">
            {(["Duplicate", "Delete"] as const).map((name) => (
              <button key={name} disabled={!!selectionReason} title={selectionReason || name}
                aria-describedby="selection-reason" onClick={() => command(name)}>
                <Icon name={name} />{name}
              </button>
            ))}
          </div>
          <div className="moves">
            {[
              ["left", -10, 0, "←"],
              ["up", 0, -10, "↑"],
              ["down", 0, 10, "↓"],
              ["right", 10, 0, "→"],
            ].map(([name, x, y, s]) => (
              <button
                key={name}
                aria-label={(selected.size > 1 ? "Move objects " : "Move object ") + name}
                disabled={!selected.size || readOnly || composing || busy}
                onClick={() => move(Number(x), Number(y))}
              >
                {s}
              </button>
            ))}
          </div>
          <small>
            X {bounds?.x ?? "—"} · Y {bounds?.y ?? "—"} · 10 units per step
          </small>
          <small>W {bounds ? Math.round(bounds.width) : "—"} · H {bounds ? Math.round(bounds.height) : "—"}</small>
          <div className="sizes">
            {[
              ["Wider", 10, 0], ["Narrower", -10, 0], ["Taller", 0, 10], ["Shorter", 0, -10],
            ].map(([name, x, y]) => <button key={name}
              aria-label={(selected.size > 1 ? "Make objects " : "Make object ") + String(name).toLowerCase()}
              disabled={!selected.size || readOnly || composing || busy}
              onClick={() => resizeBy(Number(x), Number(y))}>{name}</button>)}
          </div>
          {selected.size > 0 && <div className="objects-arrange" role="group" aria-label="Arrange">
            <h2>Arrange</h2>
            {arrangementControls("objects-arrange", arrange)}
          </div>}
          <div>
            {(["sticky", "text"] as const).map((type) => (
              <button
                key={type}
                disabled={readOnly || composing || busy}
                onClick={() => {
                  const offset = 24 * (board.objects.length % 10);
                  create(type, view.x + offset, view.y + offset, true);
                }}
              >
                Add {type}
              </button>
            ))}
          </div>
        </section>
      )}
      {selected.size > 0 && (
        <section
          ref={contextBar}
          className="context"
          aria-hidden={!contextFits}
          inert={!contextFits}
          style={{
            left: contextLeft,
            top: contextTop,
            visibility: contextFits ? "visible" : "hidden",
          }}
        >
          <span>{item ? item.type === "sticky" ? "Sticky" : "Text" : selected.size + " objects"}</span>
          <span className="divider" aria-hidden="true" />
          {item && <>
          <button
            disabled={readOnly || composing || busy}
            onMouseDown={(e) => {
              if (inline) e.preventDefault();
            }}
            onClick={() => {
              if (inline) {
                finishTextSession();
                setInline(false);
                scene.current?.focus();
              } else edit();
            }}
          >
            <Icon name="pencil" />{inline ? "Done" : "Edit text"}
          </button>
          <span className="divider" aria-hidden="true" />
          <small>{count(text)} / 1,000</small>
          </>}
          <span className="colour-control" ref={colourControl}>
            <button ref={colourButton} className="icon-button" disabled={!!selectionReason}
              aria-label={"Colour: " + colourLabel}
              title={"Colour: " + colourLabel}
              aria-describedby="selection-reason" aria-expanded={swatchOpen}
              aria-controls={swatchOpen ? "colour-swatches" : undefined}
              onClick={(e) => {
                e.currentTarget.focus();
                setArrangeFor("");
                setSwatchFor(swatchOpen ? "" : selectionKey);
              }}>
              <span className={"colour-dot" + (!selectionColor ? " mixed" : "")} style={selectionColor ? { background: colorEntry(selectionColor).fill } : undefined} />
              <span className="tooltip">Colour: {colourLabel}</span>
            </button>
            {swatchOpen && <div id="colour-swatches" ref={swatches} className="swatches"
              role="group" aria-label="Colour" style={{
                left: clamp(colourButton.current?.offsetLeft ?? 0, 0, contextWidth - 196),
                top: clamp(48, 12 - contextTop, size.h - 120 - contextTop),
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  closeSwatches();
                }
              }}>
              {COLORS.map((c) => <button key={c.name} className="icon-button"
                aria-label={c.label} title={c.label} aria-pressed={selectionColor === c.name}
                onClick={() => { changeStyle("color", c.name); closeSwatches(); }}>
                <span className="colour-dot" style={{ background: c.fill }} />
                <span className="tooltip">{c.label}</span>
              </button>)}
            </div>}
          </span>
          <select className="context-size" aria-label="Text size" title={selectionReason || "Text size"}
            value={selectionSize} disabled={!!selectionReason} aria-describedby="selection-reason"
            onChange={(e) => changeStyle("textSize", e.target.value as Style["textSize"])}>
            {!selectionSize && <option value="" disabled>Mixed</option>}
            {TEXT_SIZES.map((s) => <option key={s.name} value={s.name}>{s.label}</option>)}
          </select>
          <span className="alignments" role="group" aria-label="Alignment">
            {ALIGNMENTS.map((a) => <button key={a.name} className="icon-button"
              aria-label={a.action} title={selectionReason || a.action} aria-pressed={selectionAlign === a.name}
              disabled={!!selectionReason} aria-describedby="selection-reason"
              onClick={(e) => { e.currentTarget.focus(); changeStyle("align", a.name); }}>
              <Icon name={a.name} /><span className="tooltip">{selectionReason || a.action}</span>
            </button>)}
          </span>
          <span className="arrange-control" ref={arrangeControl}>
            <button ref={arrangeButton} className="icon-button" disabled={!!selectionReason}
              aria-label="Arrange" title={selectionReason || "Arrange"}
              aria-describedby="selection-reason" aria-expanded={arrangeOpen}
              aria-controls={arrangeOpen ? "arrange-menu" : undefined}
              onClick={(e) => {
                e.currentTarget.focus();
                setSwatchFor("");
                setArrangeFor(arrangeOpen ? "" : selectionKey);
              }}>
              <Icon name="Arrange" /><span className="tooltip">{selectionReason || "Arrange"}</span>
            </button>
            {arrangeOpen && <div id="arrange-menu" ref={arrangeMenu} className="arrange-menu"
              role="group" aria-label="Arrange" style={{
                left: clamp(arrangeButton.current?.offsetLeft ?? 0, 12 - contextLeft,
                  size.w - 280 - contextLeft),
                top: clamp(48, 12 - contextTop, size.h - 12 - arrangeHeight - contextTop),
                maxHeight: size.h - 24,
              }} onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  closeArrange();
                }
              }}>
              {arrangementControls("menu-arrange", (name) => { arrange(name); closeArrange(); })}
            </div>}
          </span>
          {(["Duplicate", "Delete"] as const).map((name) => (
            <button key={name} className="icon-button" aria-label={name}
              aria-describedby="selection-reason" disabled={!!selectionReason}
              onClick={() => command(name)}>
              <Icon name={name} /><span className="tooltip">{selectionReason || name}</span>
            </button>
          ))}
        </section>
      )}
      {inline && item && (
        <section
          ref={inlineSurface}
          className="inline"
          onPointerEnter={trackPointer}
          onPointerDown={trackPointer}
          onPointerMove={trackPointer}
          style={{
            left: pos(item).left + TEXT_INSET * view.z,
            top: pos(item).top + TEXT_INSET * view.z,
            width: (item.width - 2 * TEXT_INSET) * view.z,
            height: (itemHeight - 2 * TEXT_INSET) * view.z,
            fontFamily: TEXT_LAYOUT.fontFamily,
            fontSize: textUnits(item.textSize) * view.z,
            textAlign: item.align,
            color: textColor(item),
          }}
        >
          {nativeEditor}
        </section>
      )}
      <nav className="palette floating" aria-label="Board tools">
        {(["Select", "Pan", "Sticky", "Text"] as const).map((
          name,
        ) => (
          <button
            key={name}
            className={"icon-button" + (name === "Sticky" ? " tool-divider" : "")}
            aria-label={name + " tool"}
            aria-pressed={tool === name}
            disabled={busy || composing ||
              (readOnly && ["Sticky", "Text"].includes(name))}
            onClick={() => {
              setTool(name);
              setInline(false);
              scene.current?.focus();
            }}
          >
            <Icon name={name} />
            <span className="tooltip">{name}</span>
          </button>
        ))}
      </nav>
      <nav className="zoom floating">
        <button
          className="icon-button"
          aria-label="Zoom out"
          disabled={busy || composing}
          onClick={() => setView((v) => ({ ...v, z: stepZoom(v.z, -1) }))}
        >
          <Icon name="minus" /><span className="tooltip">Zoom out</span>
        </button>
        <span>{Math.round(view.z * 100)}%</span>
        <button
          className="icon-button"
          aria-label="Zoom in"
          disabled={busy || composing}
          onClick={() => setView((v) => ({ ...v, z: stepZoom(v.z, 1) }))}
        >
          <Icon name="plus" /><span className="tooltip">Zoom in</span>
        </button>
        <span className="divider" aria-hidden="true" />
        <button
          className="icon-button"
          aria-label="Navigation"
          aria-expanded={panel === "Navigation"}
          ref={navButton}
          onClick={() => toggle("Navigation")}
          disabled={busy || composing}
        >
          <Icon name="navigation" /><span className="tooltip">Navigation</span>
        </button>
      </nav>
      <button
        className="information floating icon-button"
        ref={infoButton}
        aria-label="About local storage"
        aria-expanded={panel === "Information"}
        disabled={busy || composing}
        onClick={() => toggle("Information")}
      >
        <Icon name="information" /><span className="tooltip">About local storage</span>
      </button>
      {panel === "Information" && (
        <section className="information-panel floating" aria-label="About local storage">
          <p>One board in this browser origin/profile. Browser storage is not a backup.</p>
          <button disabled={busy || composing} onClick={() => toggle("Information")}>Close</button>
        </section>
      )}
      {panel === "Navigation" && (
        <section className="navigation floating">
          <h2>Move around the board</h2>
          {[["left", -100, 0], ["right", 100, 0], ["up", 0, -100], [
            "down",
            0,
            100,
          ]].map(([s, x, y]) => (
            <button
              key={s}
              disabled={busy || composing}
              onClick={() =>
                setView((v) => ({
                  ...v,
                  x: clamp(v.x + Number(x), -1e6, 1e6),
                  y: clamp(v.y + Number(y), -1e6, 1e6),
                }))}
            >
              Pan {s}
            </button>
          ))}
          <button disabled={busy || composing} onClick={() => setView({ x: 0, y: 0, z: 1 })}>
            Reset view
          </button>
          <button
            disabled={busy || composing}
            onClick={() => {
              setPanel("");
              navButton.current?.focus();
            }}
          >
            Close navigation
          </button>
        </section>
      )}
    </main>
  );
}
