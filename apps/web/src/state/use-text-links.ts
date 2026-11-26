// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState, type RefObject } from "react";
import { count, type BoardV17 as Board } from "nextphase-board-rules/document.ts";
import { codePointOffset, type TextSelection } from "nextphase-board-rules/marks.ts";
import { linkAddress, linkAt, setLink, touchesLink } from "nextphase-board-rules/text-link.ts";
import { hasText, objectKind, objectType } from "nextphase-board-rules/objects/registry.ts";
import { clipboardRefused, pageLink } from "../page-links";
import {
  blockingSurfaceOpen, cardPlace, copyObjectLabel, isLinkShortcut, isMac, isPlainPasteKey, linkButton, linkLabel, linkTooltip,
  linkUnder, LINK_WORDS, objectCopied, pastedLink, sameBoardLink, toUnits,
  type EditorLinks, type LinkBarModel, type LinkCardModel, type LinkControls, type LinkHit, type LinkPages, type LinkPointer, type LinkPress,
} from "../text-links";
import type { HostedBoard } from "../team/hosted-board";
import type { ResolvedItem as Item } from "../geometry";
import type { View } from "../view";
import type { LinkSpan, RunLine } from "../text-runs";

type Range = { start: number; end: number };
type Target = Range & { id: string };
type Bar = Target & { text: string; value: string; refused: boolean };
type Hover = { key: string; hit: LinkHit };
type Followed = Pick<LinkPress, "id" | "run"> & { at: number; repeated: boolean };
type Timer = ReturnType<typeof setTimeout>;

type TextLinksInput = {
  hosted?: HostedBoard;
  pages: LinkPages;
  board: Board;
  model: RefObject<Board>;
  commit: (board: Board, record?: boolean) => void;
  objects: Item[];
  objectLayouts: ReadonlyMap<string, { height: number; runs: RunLine[] | null; links: LinkSpan[] }>;
  selected: Set<string>;
  select: (id: string) => void;
  textSelection: TextSelection | null;
  inline: boolean;
  edit: (target?: Item) => void;
  editor: RefObject<HTMLTextAreaElement | null>;
  finishTextSession: () => void;
  scene: RefObject<HTMLDivElement | null>;
  readOnly: boolean;
  busy: boolean;
  composing: boolean;
  tool: string;
  tidyOpen: boolean;
  barShown: boolean;
  selectionReason: string;
  ownCopy: (text: string) => boolean;
  view: View;
  size: { w: number; h: number };
  pos: (point: { x: number; y: number }) => { left: number; top: number };
  setMessage: (message: string) => void;
};

const sameRun = (a: Pick<LinkPress, "id" | "run">, b: Pick<LinkPress, "id" | "run">) =>
  a.id === b.id && a.run.start === b.run.start && a.run.end === b.run.end;

export function useTextLinks(input: TextLinksInput) {
  const { board, model, selected, objects, objectLayouts, pages, view, inline, editor, readOnly, busy, composing, tidyOpen } = input;
  const [bar, setBar] = useState<Bar | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [cardSize, setCardSize] = useState({ width: 0, height: 36 });
  const pending = useRef<Target | null>(null), handoff = useRef<Target | null>(null);
  const armed = useRef<(Hover & { timer?: Timer }) | null>(null), hideTimer = useRef<Timer | undefined>(undefined);
  const swallowClick = useRef(false), followed = useRef<Followed | null>(null);
  const plainPaste = useRef(false), composition = useRef<Range | undefined>(undefined);
  const chosen = board.objects.filter(o => selected.has(o.id));
  const selectedObject = chosen.length === 1 ? chosen[0] : undefined;
  const rich = selectedObject && hasText(selectedObject) && objectType(selectedObject.type).richText ? selectedObject : undefined;
  const length = rich ? count(rich.text) : 0;
  const range = inline ? input.textSelection?.id === rich?.id ? input.textSelection : null : { start: 0, end: length };
  const button = linkButton({ selectionReason: input.selectionReason, objects: chosen, editing: inline,
    marks: rich?.marks ?? [], length, start: range?.start ?? 0, end: range?.end ?? 0 });
  if (pending.current && (!inline || rich?.id !== pending.current.id)) pending.current = null;
  const open = bar && inline && !readOnly && bar.id === rich?.id && bar.text === rich.text ? bar : null;
  if (bar && !open) closeBar();

  const key = JSON.stringify([board.boardId, pages.id, view.x, view.y, view.z, [...selected].sort(), inline]);
  const hoverAllowed = input.tool === "Select" && !busy && !composing && !inline && !tidyOpen && !input.hosted?.voting.mode && !open;
  const validHover = (candidate: Hover) => hoverAllowed && candidate.key === key && objects.some(o => o.id === candidate.hit.id);
  if (armed.current && !validHover(armed.current)) cancelShow();
  const shown = hover && validHover(hover) ? hover : null;
  if (hover && !shown) { cancelHide(); setHover(null); }
  const latest = useRef({ open, closeBar, shown, key, hoverAllowed });
  latest.current = { open, closeBar, shown, key, hoverAllowed };

  function cancelShow() {
    clearTimeout(armed.current?.timer);
    armed.current = null;
  }
  function cancelHide() {
    clearTimeout(hideTimer.current);
    hideTimer.current = undefined;
  }
  function hideCard() {
    cancelShow(); cancelHide(); setHover(null);
  }
  function leave() {
    cancelShow();
    if (latest.current.shown && hideTimer.current === undefined) {
      hideTimer.current = setTimeout(() => { hideTimer.current = undefined; setHover(null); }, 200);
    }
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") hideCard(); };
    const pointerdown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      swallowClick.current = false;
      cancelShow();
      if (latest.current.shown && !target?.closest(".link-card")) hideCard();
      if (latest.current.open && !target?.closest(".link-bar")) {
        latest.current.closeBar();
        event.preventDefault(); event.stopPropagation();
        swallowClick.current = true;
      }
    };
    const click = (event: MouseEvent) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      event.preventDefault(); event.stopPropagation();
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("pointerdown", pointerdown, true);
    window.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("pointerdown", pointerdown, true);
      window.removeEventListener("click", click, true);
      cancelShow(); cancelHide();
    };
  }, []);

  useEffect(() => {
    const target = handoff.current;
    if (!target) return;
    handoff.current = null;
    const field = editor.current;
    if (inline && !readOnly && field && rich?.id === target.id) {
      field.focus();
      field.setSelectionRange(toUnits(field.value, target.start), toUnits(field.value, target.end));
    } else input.scene.current?.focus();
  });

  function closeBar() {
    if (!bar) return;
    handoff.current = bar;
    setBar(null);
  }
  function openBar(target: Target) {
    const object = model.current.objects.find(o => o.id === target.id);
    if (!object || !hasText(object) || readOnly) return false;
    const run = linkAt(object.marks, count(object.text), target.start, target.end);
    if (target.start === target.end && !run) return false;
    setBar({ ...target, ...(target.start === target.end && run ? { start: run.start, end: run.end } : {}),
      text: object.text, value: run?.href ?? "", refused: false });
    return true;
  }
  function activateLink() {
    if (button.disabled || !rich || !range) return false;
    const target = { id: rich.id, start: range.start, end: range.end };
    if (inline) return openBar(target);
    pending.current = target;
    input.edit();
    return true;
  }
  const shortcut = () => input.barShown && activateLink();

  function changeLink(target: Target, text: string, href: string | null) {
    if (readOnly || composing) return false;
    const object = model.current.objects.find(o => o.id === target.id);
    if (!object || !hasText(object) || !objectType(object.type).richText || object.text !== text) return false;
    const marks = setLink(object.marks, text, target.start, target.end, href);
    input.finishTextSession();
    input.commit({ ...model.current, objects: model.current.objects.map(o => o.id === object.id ? { ...object, marks } : o) }, true);
    return true;
  }
  let barModel: LinkBarModel | null = null;
  if (open && rich) {
    const address = linkAddress(open.value);
    const canRemove = touchesLink(rich.marks, length, open.start, open.end);
    const apply = () => { if (address.ok) { changeLink(open, open.text, address.href); closeBar(); } };
    barModel = { value: open.value, refused: open.refused, canApply: address.ok, canRemove, left: 0,
      change: value => setBar({ ...open, value, refused: false }),
      submit: () => { if (address.ok) apply(); else if (open.value.trim()) setBar({ ...open, refused: true }); },
      apply, remove: () => { if (canRemove) { changeLink(open, open.text, null); closeBar(); } }, close: closeBar };
  }

  const editorLinks: EditorLinks = {
    open: !!open,
    key(event) {
      if (isPlainPasteKey(event)) plainPaste.current = true;
      return inline && isLinkShortcut(event) && shortcut();
    },
    paste(event) {
      const plain = plainPaste.current;
      plainPaste.current = false;
      if (plain || !inline || readOnly || busy || composing || input.selectionReason || !rich || event.clipboardData?.files.length) return false;
      const field = editor.current;
      if (!field || field.selectionStart === field.selectionEnd) return false;
      const raw = event.clipboardData?.getData("text/plain") ?? "";
      if (input.ownCopy(raw)) return false;
      const href = pastedLink(raw);
      if (!href) return false;
      return changeLink({ id: rich.id, start: codePointOffset(field.value, field.selectionStart),
        end: codePointOffset(field.value, field.selectionEnd) }, field.value, href);
    },
    keepsEditing(next) { return next instanceof Element && !!next.closest(".link-bar"); },
    compositionStart(value) { composition.current = value ?? undefined; },
    compositionEdit() { const value = composition.current; composition.current = undefined; return value; },
  };

  function copy(href: string, message: string) {
    let write: Promise<void> | undefined;
    try { write = navigator.clipboard?.writeText(href); } catch { /* Clipboard is unavailable. */ }
    if (!write) input.setMessage(clipboardRefused);
    else void write.then(() => input.setMessage(message), () => input.setMessage(clipboardRefused));
  }
  const kind = selectedObject ? objectKind(selectedObject.type).kind : "";
  const controls: LinkControls = {
    link: { ...button, tooltip: button.reason || linkTooltip(isMac(navigator.platform)), run: activateLink },
    copy: { shown: !!selectedObject, label: copyObjectLabel(kind), run() {
      if (!selectedObject) return;
      const object = model.current.objects.find(o => o.id === selectedObject.id);
      if (object) copy(pageLink(location.href, object.page, input.hosted?.boardId, object.id), objectCopied(kind, !!input.hosted));
    } },
    bar: barModel,
  };

  function hit(point: { x: number; y: number }) {
    return linkUnder(objects, objectLayouts, point, view.z, inline ? rich?.id : undefined);
  }
  const pointer: LinkPointer = {
    move(point, event) {
      if (event.buttons || event.pointerType !== "mouse" && event.pointerType !== "pen" || !hoverAllowed) return;
      const next = hit(point);
      if (!next) { leave(); return; }
      if (shown && sameRun(shown.hit, next)) { cancelShow(); cancelHide(); return; }
      if (armed.current && sameRun(armed.current.hit, next)) return;
      leave();
      const candidate: Hover & { timer?: Timer } = { key, hit: next };
      candidate.timer = setTimeout(() => {
        candidate.timer = undefined;
        const current = latest.current;
        if (armed.current !== candidate || current.key !== candidate.key || !current.hoverAllowed || blockingSurfaceOpen(document)) return;
        cancelShow(); cancelHide(); setHover(candidate);
      }, 300);
      armed.current = candidate;
    },
    leave,
    press(point) {
      const found = !inline && hit(point);
      return found ? { board: model.current.boardId, page: pages.id, id: found.id, run: found.run, href: found.href, address: location.href } : undefined;
    },
    follow(press, point) {
      if (inline || composing || model.current.boardId !== press.board || pages.id !== press.page || location.href !== press.address) return false;
      const found = hit(point);
      if (!found || !sameRun(found, press) || found.href !== press.href) return false;
      const current = model.current.objects.find(o => o.id === press.id && o.page === pages.id);
      if (!current || !hasText(current)) return false;
      const run = linkAt(current.marks, count(current.text), found.box.start, found.box.start + 1);
      if (!run || run.href !== press.href || run.start !== press.run.start || run.end !== press.run.end) return false;
      const address = linkAddress(press.href);
      if (!address.ok) return false;
      const target = sameBoardLink(address.href, press.address, input.hosted?.boardId);
      if (target) {
        if (target.object === undefined && target.page === pages.id) return false;
        pages.openLink(target.page, target.object, "click");
      } else window.open(address.href, "_blank", "noopener,noreferrer");
      followed.current = { id: press.id, run: press.run, at: performance.now(), repeated: false };
      return true;
    },
    repeats(press) {
      const last = followed.current;
      if (last && !last.repeated && press && performance.now() - last.at <= 500 && sameRun(last, press)) {
        last.repeated = true;
        return true;
      }
      followed.current = null;
      return false;
    },
    doubled(point) {
      const last = followed.current;
      followed.current = null;
      return !!last?.repeated && hit(point)?.id === last.id;
    },
  };

  let card: LinkCardModel | null = null;
  if (shown) {
    const { hit } = shown;
    const { left, top } = input.pos(hit.first);
    const bottom = input.pos({ x: hit.first.x, y: hit.first.y + hit.first.height }).top;
    card = { ...cardPlace({ left, top, bottom }, cardSize, { width: input.size.w, height: input.size.h }),
      label: linkLabel(hit.href, board, location.href, input.hosted?.boardId), editable: !readOnly,
      copy: () => copy(hit.href, LINK_WORDS.copied),
      edit() {
        if (readOnly || input.selectionReason) return;
        const target = objects.find(o => o.id === hit.id);
        if (!target || !hasText(target)) return;
        const run = linkAt(target.marks, count(target.text), hit.run.start, hit.run.end);
        if (!run || run.href !== hit.href || run.start !== hit.run.start || run.end !== hit.run.end) return;
        pending.current = { id: target.id, start: run.start, end: run.end };
        input.select(target.id);
        input.edit(target);
      },
      enter: cancelHide, leave,
      measure(element) {
        if (element && (cardSize.width !== element.offsetWidth || cardSize.height !== element.offsetHeight)) {
          setCardSize({ width: element.offsetWidth, height: element.offsetHeight });
        }
      } };
  }
  return { pointer, shortcut, editor: editorLinks, controls, card,
    placed(accepted: boolean) {
      const target = pending.current;
      pending.current = null;
      const field = editor.current;
      if (!accepted || !target || !field || rich?.id !== target.id) return;
      field.setSelectionRange(toUnits(field.value, target.start), toUnits(field.value, target.end));
      openBar(target);
    } };
}
