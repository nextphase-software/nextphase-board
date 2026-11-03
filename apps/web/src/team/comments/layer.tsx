// SPDX-License-Identifier: Apache-2.0
import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { BoardV10 } from "nextphase-board-rules/document.ts";
import { hasEnds, hasRectangle } from "nextphase-board-rules/objects/registry.ts";
import type { ResolvedItem } from "../../geometry";
import { hitObject } from "../../connectors";
import { screenPoint, type View } from "../../view";
import type { HostedBoard } from "../hosted-board";
import { CommentCard, CommentField, type Draft } from "./card";
import { CommentsPanel } from "./panel";
import { CommentIcon } from "./icons";
import { anchorAt, anchorPoint, authorColour, drawingOrder, placeBox, refusalWords, threadName, visibleThreads,
  words, type Anchor, type CommentOperation, type CommentThread, type Point } from "./rules";

type Props = { hosted: HostedBoard; board: BoardV10; objects: ResolvedItem[]; view: View; size: { w: number; h: number };
  tool: string; setTool: Dispatch<SetStateAction<string>>; setView: Dispatch<SetStateAction<View>>;
  scene: RefObject<HTMLDivElement | null>; select: (value: string) => void; setInline: Dispatch<SetStateAction<boolean>> };
export function CommentsLayer({ hosted, board, objects, view, size, tool, setTool, setView, scene, select, setInline }: Props) {
  const [, redraw] = useState(0), [hidden, setHidden] = useState(false);
  const [showResolved, setResolved] = useState(false), [onlyYours, setYours] = useState(false);
  const [composer, setComposer] = useState<Anchor | null>(null), [draft, setDraft] = useState<Draft>({ text: "" });
  const [opened, setOpened] = useState<CommentThread | null>(null), [hover, setHover] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; thread?: string; error?: boolean } | null>(null);
  const [moves, setMoves] = useState<Record<string, Point>>({});
  const deletedBy = useRef(new Map<string, string>()), resolvedBy = useRef(new Map<string, string>());
  const actions = useRef(new Map<string, { operation: CommentOperation; resolve: boolean }>());
  const lastPoints = useRef(new Map<string, Point>()), pins = useRef(new Map<string, HTMLButtonElement>());
  const composerBox = useRef<HTMLDivElement>(null), [composerHeight, setComposerHeight] = useState(42);
  const arrow = useRef<{ thread: CommentThread; point: Point; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const spaceHeld = useRef(false);
  const mode = tool === "Comment", previousMode = useRef(false);
  const threads = hosted.comments.threads, current = opened && threads?.get(opened.id);
  const ready = hosted.comments.ready;
  useEffect(() => hosted.subscribeComments((event) => {
    if (event?.kind === "comment_changed") {
      const id = String(event.threadId), thread = event.thread as CommentThread | null | undefined;
      if (event.thread === null && typeof event.by === "string") deletedBy.current.set(id, event.by);
      if (event.sequence !== undefined && thread?.resolved && typeof event.by === "string") resolvedBy.current.set(id, event.by);
      if (thread && !thread.resolved) resolvedBy.current.delete(id);
    } else if (event?.kind === "comments_snapshot" && event.reset) resolvedBy.current.clear();
    if (event?.kind === "comment_saved" || event?.kind === "comment_refused") {
      const action = actions.current.get(String(event.requestId));
      if (action) {
        actions.current.delete(String(event.requestId));
        if (event.kind === "comment_refused") setToast({ text: refusalWords(String(event.reason), false, action.operation.action), error: true });
        else if (action.resolve) { setOpened(null); scene.current?.focus(); setToast({ text: words.resolved, thread: action.operation.threadId }); }
      }
    }
    redraw((value) => value + 1);
  }), [hosted]);
  useEffect(() => {
    if (!toast || toast.error) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (mode) { select(""); setInline(false); }
    else if (previousMode.current) { setComposer(null); setDraft({ text: "" }); setOpened(null); }
    previousMode.current = mode;
  }, [mode]);
  useLayoutEffect(() => {
    if (composerBox.current) setComposerHeight(composerBox.current.getBoundingClientRect().height);
  }, [composer, draft, ready]);
  useEffect(() => () => { if (arrow.current?.timer) clearTimeout(arrow.current.timer); }, []);
  function point(event: { clientX: number; clientY: number }) {
    const rect = scene.current!.getBoundingClientRect();
    return { x: view.x + (event.clientX - rect.left - size.w / 2) / view.z,
      y: view.y + (event.clientY - rect.top - size.h / 2) / view.z };
  }
  function anchor(point: Point) { return anchorAt(board, point, !!hasConnector(point)); }
  function hasConnector(point: Point) { const hit = hitObject(objects, point, view.z); return hit && hasEnds(hit); }
  function closeCard() {
    const id = opened?.id; setOpened(null);
    requestAnimationFrame(() => (id && pins.current.get(id) || scene.current)?.focus());
  }
  function open(thread: CommentThread, centre = false) {
    setComposer(null); setDraft({ text: "" }); setOpened(thread);
    if (centre) {
      const p = pinPoint(thread);
      setView({ ...view, x: p.x + (window.innerWidth >= 768 ? 140 / view.z : 0), y: p.y });
    }
  }
  function action(operation: CommentOperation, resolve = false) {
    const request = hosted.comment(operation);
    if (hosted.comments.requests?.has(request)) actions.current.set(request, { operation, resolve });
    else setToast({ text: refusalWords(request, false, operation.action), error: true });
  }
  function place(point: Point) { setOpened(null); setComposer(anchor(point)); }
  useEffect(() => {
    const canvas = scene.current;
    if (!canvas) return;
    const keys = (event: globalThis.KeyboardEvent) => {
      const target = event.target as Element;
      if (target.closest(".comment-card,.comment-composer,.comment-menu")) return;
      if (event.key === "Escape" && !event.isComposing) {
        if (composer) { setComposer(null); setDraft({ text: "" }); canvas.focus(); }
        else if (opened) closeCard();
        else if (mode) { setTool("Select"); canvas.focus(); }
        else return;
        event.preventDefault(); event.stopPropagation(); return;
      }
      if (target.closest('input,textarea,[contenteditable]:not([contenteditable=false]),dialog,[role="dialog"],[role="alertdialog"]') || event.isComposing) return;
      if (event.code === "Space") spaceHeld.current = true;
      if (event.key.toLowerCase() === "c" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault(); event.stopPropagation();
        if (event.shiftKey) setHidden((value) => !value); else { setTool("Comment"); canvas.focus(); }
      } else if (mode && target === canvas && event.key === "Enter") {
        event.preventDefault(); event.stopPropagation(); place({ x: view.x, y: view.y });
      } else if (mode && target === canvas && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
        event.preventDefault(); event.stopPropagation();
      }
    };
    const up = (event: globalThis.KeyboardEvent) => { if (event.code === "Space") spaceHeld.current = false; };
    const down = (event: globalThis.PointerEvent) => {
      if (!mode || event.button !== 0 || spaceHeld.current || !(event.target === canvas || event.target instanceof HTMLCanvasElement)) return;
      event.preventDefault(); event.stopPropagation(); place(point(event));
    };
    const move = (event: globalThis.PointerEvent) => { if (mode) setHover(anchor(point(event)).objectId); };
    const leave = () => setHover(null);
    window.addEventListener("keydown", keys, true); window.addEventListener("keyup", up, true);
    canvas.addEventListener("pointerdown", down, true); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("keydown", keys, true); window.removeEventListener("keyup", up, true);
      canvas.removeEventListener("pointerdown", down, true); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerleave", leave);
    };
  }, [board, view, size, mode, composer, opened, objects]);
  function pinPoint(thread: CommentThread) {
    if (moves[thread.id]) return moves[thread.id];
    const missing = !thread.anchor.detached && thread.anchor.objectId && !board.objects.some((object) => object.id === thread.anchor.objectId);
    const p = missing ? lastPoints.current.get(thread.id) ?? anchorPoint(thread.anchor, board) : anchorPoint(thread.anchor, board);
    lastPoints.current.set(thread.id, p); return p;
  }
  function moved(thread: CommentThread, point: Point) {
    action({ action: "move", threadId: thread.id, anchor: thread.anchor.detached ? { ...thread.anchor, ...point, objectId: null, u: 0, v: 0 } : anchor(point) });
    setMoves((moves) => { const next = { ...moves }; delete next[thread.id]; return next; });
  }
  function flushArrow() {
    const pending = arrow.current; arrow.current = null;
    if (pending) { clearTimeout(pending.timer); moved(pending.thread, pending.point); }
  }
  const visible = visibleThreads(threads?.values() ?? [], hosted.comments.person, showResolved, onlyYours);
  const ordered = [...visible].sort((a, b) => {
    const object = (thread: CommentThread) => !thread.anchor.detached && board.objects.find((object) => object.id === thread.anchor.objectId);
    const left = object(a), right = object(b);
    return left && right ? drawingOrder(left, right) || a.sequence - b.sequence : left ? -1 : right ? 1 : a.sequence - b.sequence;
  });
  const rect = scene.current?.getBoundingClientRect();
  const area = { w: size.w, h: Math.min(size.h, window.innerHeight - (rect?.top ?? 0)) };
  const cardThread = current ?? opened;
  return <>
    <div className="comment-pins" role="group" aria-label="Comment pins">
      {mode && [...new Set([hover, composer?.objectId])].map((id) => {
        const object = board.objects.find((object) => object.id === id);
        if (!object || !hasRectangle(object)) return null;
        const p = screenPoint(object, view, size);
        return <div key={id} className="comment-attach-outline" style={{ left: p.left - 2, top: p.top - 2, width: object.width * view.z + 4, height: object.height * view.z + 4 }} />;
      })}
      {!hidden && ordered.map((thread) => {
        const p = screenPoint(pinPoint(thread), view, size), own = thread.person === hosted.comments.person;
        const detached = thread.anchor.detached || !!thread.anchor.objectId && !board.objects.some((object) => object.id === thread.anchor.objectId);
        return <button key={thread.id} ref={(node) => { if (node) pins.current.set(thread.id, node); else pins.current.delete(thread.id); }}
          className={"comment-pin" + (opened?.id === thread.id ? " open" : "") + (thread.resolved ? " resolved" : "") + (detached ? " detached" : "")}
          style={{ left: p.left, top: p.top - 32 }} aria-label={threadName(thread, board)} onClick={() => open(thread)}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (!own || !ready || event.button !== 0) return;
            const button = event.currentTarget, start = { x: event.clientX, y: event.clientY }, initial = pinPoint(thread);
            let next = initial, dragged = false;
            button.setPointerCapture(event.pointerId);
            const move = (event: globalThis.PointerEvent) => {
              dragged ||= Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 4;
              if (dragged) { next = { x: initial.x + (event.clientX - start.x) / view.z, y: initial.y + (event.clientY - start.y) / view.z }; setMoves((moves) => ({ ...moves, [thread.id]: next })); }
            };
            const end = (event: globalThis.PointerEvent) => {
              button.removeEventListener("pointermove", move); button.removeEventListener("pointerup", finish); button.removeEventListener("pointercancel", cancel);
              if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
            };
            const cancel = (event: globalThis.PointerEvent) => { end(event); setMoves((moves) => { const next = { ...moves }; delete next[thread.id]; return next; }); };
            const finish = (event: globalThis.PointerEvent) => { end(event); if (dragged) moved(thread, next); };
            button.addEventListener("pointermove", move); button.addEventListener("pointercancel", cancel); button.addEventListener("pointerup", finish);
          }} onBlur={flushArrow} onKeyDown={(event) => {
            if (!event.key.startsWith("Arrow") || !own || !ready) return;
            event.preventDefault(); event.stopPropagation();
            const start = arrow.current?.thread.id === thread.id ? arrow.current.point : pinPoint(thread), distance = event.shiftKey ? 10 : 1;
            const next = { x: start.x + (event.key === "ArrowRight" ? distance : event.key === "ArrowLeft" ? -distance : 0),
              y: start.y + (event.key === "ArrowDown" ? distance : event.key === "ArrowUp" ? -distance : 0) };
            if (arrow.current?.timer) clearTimeout(arrow.current.timer);
            arrow.current = { thread, point: next, timer: setTimeout(flushArrow, 500) }; setMoves((moves) => ({ ...moves, [thread.id]: next }));
          }}>
          <span className="comment-initial" style={{ background: authorColour(thread.person) }}>{thread.label[0]?.toUpperCase()}</span>
          {detached && <span className="comment-badge"><CommentIcon name="unlink" /></span>}
        </button>;
      })}
      {composer && <div className="comment-pin new" aria-hidden="true" style={{ left: screenPoint(composer, view, size).left, top: screenPoint(composer, view, size).top - 32 }}>
        <span className="comment-initial">{hosted.comments.label[0]?.toUpperCase()}</span></div>}
    </div>
    {mode && <CommentsPanel threads={visible} board={board} current={opened?.id} showResolved={showResolved} onlyYours={onlyYours}
      setResolved={setResolved} setYours={setYours} open={(thread) => open(thread, true)} close={() => { setTool("Select"); scene.current?.focus(); }} />}
    {composer && mode && <div ref={composerBox} className="comment-composer" role="dialog" aria-label="New comment"
      style={placeBox(screenPoint(composer, view, size), area, window.innerWidth, mode, true, composerHeight)}
      onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); setComposer(null); setDraft({ text: "" }); scene.current?.focus(); } }}>
      <CommentField hosted={hosted} draft={draft} change={setDraft} label="Add a comment" operation={() => ({ action: "start", threadId: crypto.randomUUID(), commentId: crypto.randomUUID(), anchor: composer, text: draft.text })}
        saved={() => { const request = hosted.comments.requests?.get(draft.request!); const id = request && JSON.parse(request.text).operation.threadId; const thread = threads?.get(id); setComposer(null); if (thread) setOpened(thread); }} />
    </div>}
    {cardThread && <CommentCard key={cardThread.id} hosted={hosted} thread={cardThread} exists={!!current || !ready}
      deletedBy={deletedBy.current.get(cardThread.id)} resolvedBy={resolvedBy.current.get(cardThread.id)}
      style={placeBox(screenPoint(pinPoint(cardThread), view, size), area, window.innerWidth, mode)} close={closeCard} action={action} />}
    {toast && <div className={"team-toast comment-toast" + (toast.error ? " error" : "")} role={toast.error ? "alert" : "status"}>
      {toast.text}<button onClick={() => { if (toast.thread) action({ action: "reopen", threadId: toast.thread }); setToast(null); }}>{toast.error ? "Dismiss" : "Undo"}</button>
    </div>}
  </>;
}
