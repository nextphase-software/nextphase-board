// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { BoardV13 as Board } from 'nextphase-board-rules/document.ts';
import { addPage, deletePage, duplicatePage, duplicatePageReason, fallbackPage, movePage, movedSet, moveToPage, pageBoard, pageObjects, renamePage, PAGE_LIMIT } from '../pages';
import { fitView, freeArea, type View } from '../view';
import { objectBox, unionBoxes } from '../find';
import type { ResolvedItem } from '../geometry';

type Input = {
  board: Board; model: RefObject<Board>; stepPage: RefObject<string | undefined>; hosted: boolean;
  commit: (board: Board, record?: boolean) => void; finishTextSession: () => void;
  select: (value: string | Iterable<string>) => void; setMessage: (value: string) => void;
  getView: () => View; setView: (view: View) => void; getObjects: () => readonly ResolvedItem[];
  openingReason: () => string; editingReason: () => string;
};
type Drag = { id: string; y: number; active: boolean; gap: number };
export type Pages = ReturnType<typeof usePages>;
export const rememberedPageKey = (board: string) => `nextphase-board/page/v1/${board}`;
function remembered(board: Board, hosted: boolean): string {
  if (!hosted) try { const id = localStorage.getItem(rememberedPageKey(board.boardId)); if (board.pages.some(p => p.id === id)) return id!; } catch { /* Optional browser preference. */ }
  return board.pages[0].id;
}
export function usePages(input: Input) {
  const { board, model, hosted, commit, finishTextSession, select, setMessage } = input;
  const [state, setState] = useState(() => ({ boardId: board.boardId, id: remembered(board, hosted), open: false,
    menu: '', editing: '', name: '', drag: null as Drag | null, moveOpen: false, go: null as { id: string; text: string } | null }));
  const views = useRef(new Map<string, View>()), button = useRef<HTMLButtonElement | null>(null), panel = useRef<HTMLElement | null>(null);
  const names = useRef(new Map<string, HTMLButtonElement>()), options = useRef(new Map<string, HTMLButtonElement>());
  const nameField = useRef<HTMLInputElement | null>(null), pageMenu = useRef<HTMLDivElement | null>(null), moveButton = useRef<HTMLButtonElement | null>(null), moveMenu = useRef<HTMLDivElement | null>(null);
  const latest = useRef({ state, input, finishName: (_keep: boolean) => {}, closeList: () => {} });
  latest.current = { state, input, finishName, closeList };
  const click = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), skipClick = useRef(false);
  const same = state.boardId === board.boardId;
  const id = same && board.pages.some(p => p.id === state.id) ? state.id : remembered(board, hosted);
  if (!same) { views.current.clear(); setState({ ...state, boardId: board.boardId, id, open: false, menu: '', editing: '', drag: null, moveOpen: false, go: null }); }
  const currentPage = useRef(id); currentPage.current = id;
  input.stepPage.current = id;
  const focused = useRef({ open: false, menu: '', editing: '', moveOpen: false });
  const transitionView = useRef<View | undefined>(undefined); transitionView.current = undefined;
  function remember(next: string) {
    if (!hosted) try { localStorage.setItem(rememberedPageKey(model.current.boardId), next); } catch { /* Optional browser preference. */ }
  }
  function openPage(next: string, force = false, fitSource = next): View | undefined {
    if (!force && input.openingReason() || !model.current.pages.some(p => p.id === next)) return;
    finishTextSession(); select('');
    const view = transitionView.current ?? input.getView();
    const leaving = currentPage.current; views.current.set(leaving, view);
    let target = views.current.get(next);
    if (!target) {
      const objects = input.getObjects().filter(o => o.page === fitSource), box = unionBoxes(objects.map(objectBox));
      const size = { w: window.innerWidth, h: window.innerHeight };
      const palette = document.querySelector('nav.palette')?.getBoundingClientRect();
      const navigation = document.querySelector('.navigation')?.getBoundingClientRect();
      target = box ? fitView(box, freeArea(size, palette?.top ?? size.h - 68, navigation?.left), size) : { x: 0, y: 0, z: 1 };
    }
    if (next !== leaving) { input.setView(target); transitionView.current = target; }
    setState(s => ({ ...s, id: next, menu: '', moveOpen: false })); remember(next); input.stepPage.current = next; currentPage.current = next;
    return next === leaving ? view : target;
  }
  function closeList() {
    if (panel.current?.contains(document.activeElement) || pageMenu.current?.contains(document.activeElement)) button.current?.focus();
    setState(s => ({ ...s, open: false, menu: '', editing: '', drag: null }));
  }
  function focusName(next: string) { queueMicrotask(() => names.current.get(next)?.focus()); }
  function finishName(keep: boolean) {
    const current = latest.current.state, value = nameField.current?.value ?? current.name;
    if (!current.editing) return;
    if (keep && !input.editingReason()) commit(renamePage(model.current, current.editing, value), true);
    setState(s => ({ ...s, editing: '' })); focusName(current.editing);
  }
  function rename(id: string) {
    clearTimeout(click.current);
    if (input.editingReason()) return;
    setState(s => ({ ...s, menu: '', editing: id, name: model.current.pages.find(p => p.id === id)!.name }));
  }
  function step(action: () => void) {
    if (input.editingReason()) return;
    finishTextSession();
    try { action(); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }
  function add() { step(() => {
    const result = addPage(model.current); commit(result.board, true); openPage(result.page.id, true);
    setState(s => ({ ...s, open: true, editing: result.page.id, name: result.page.name }));
  }); }
  function choose(action: string, target: string) {
    if (action === 'Rename page') { rename(target); return; }
    step(() => {
      if (action === 'Duplicate page') {
        const result = duplicatePage(model.current, target); commit(result.board, true); openPage(result.page.id, true, target); setMessage(result.notice);
      } else if (action === 'Delete page') {
        const result = deletePage(model.current, target, id); commit(result.board, true);
        if (result.open !== id) openPage(result.open, true);
        setMessage(result.notice);
      } else commit(movePage(model.current, target, model.current.pages.findIndex(p => p.id === target) + (action === 'Move up' ? -1 : 1)), true);
      closeList();
    });
  }
  // Both popovers share this listener and the single page state owner.
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const target = event.target as Node, current = latest.current.state;
      if (current.editing && !nameField.current?.contains(target)) latest.current.finishName(true);
      if (current.open && !panel.current?.contains(target) && !pageMenu.current?.contains(target) && !button.current?.contains(target)) latest.current.closeList();
      if (current.moveOpen && !moveMenu.current?.contains(target) && !moveButton.current?.contains(target)) setState(s => ({ ...s, moveOpen: false }));
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, []);
  // Focus after React has installed the new row or menu; no DOM state owns pages.
  useEffect(() => {
    if (state.editing && input.editingReason()) { setState(s => ({ ...s, editing: '' })); focusName(state.editing); return; }
    const previous = focused.current;
    focused.current = { open: state.open, menu: state.menu, editing: state.editing, moveOpen: state.moveOpen };
    if (state.editing && state.editing !== previous.editing) { nameField.current?.focus(); nameField.current?.select(); }
    else if (state.menu && state.menu !== previous.menu) pageMenu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    else if (state.moveOpen && !previous.moveOpen) moveMenu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    else if (state.open && !previous.open) names.current.get(id)?.focus();
  });
  function afterHistory(before: Board, next: Board, step?: string) {
    const fallback = fallbackPage(before, next, id);
    if (fallback !== id) openPage(fallback, true);
    if (step && next.pages.some(p => p.id === step) && step !== fallback) openPage(step, true);
  }
  function beginDrag(target: string, y: number) { if (!input.editingReason()) setState(s => ({ ...s, drag: { id: target, y, active: false, gap: model.current.pages.findIndex(p => p.id === target) } })); }
  function dragTo(y: number) {
    const drag = latest.current.state.drag;
    if (!drag) return;
    const active = drag.active || Math.abs(y - drag.y) >= 4;
    const rows = model.current.pages.filter(p => p.id !== drag.id);
    let gap = rows.findIndex(p => { const rect = names.current.get(p.id)?.getBoundingClientRect(); return rect && y < rect.top + rect.height / 2; });
    if (gap < 0) gap = rows.length;
    setState(s => ({ ...s, drag: { ...drag, active, gap } }));
  }
  function endDrag(cancel = false) {
    const drag = latest.current.state.drag; if (cancel && drag?.active) skipClick.current = true; setState(s => ({ ...s, drag: null }));
    if (!cancel && drag?.active) step(() => commit(movePage(model.current, drag.id, drag.gap), true));
    return !!drag?.active;
  }
  return { id, local: !hosted, list: board.pages, open: same && state.open && !hosted, menu: state.menu, editing: state.editing,
    name: state.name, drag: state.drag, moveOpen: state.moveOpen, go: state.go, get openingReason() { return input.openingReason(); }, get editingReason() { return input.editingReason(); },
    get addReason() { return input.editingReason() || (board.pages.length >= 50 ? PAGE_LIMIT : ''); }, duplicateReason: (target: string) => input.editingReason() || duplicatePageReason(board, target),
    button, panel, names, options, nameField, pageMenu, moveButton, moveMenu,
    objects: (value = board) => pageObjects(value, id), canvas: (value = board) => pageBoard(value, id),
    toggle: () => state.open ? closeList() : setState(s => ({ ...s, open: true })), closeList, openPage, add, rename, finishName, choose, afterHistory,
    clickPage: (target: string) => { if (skipClick.current) { skipClick.current = false; return; } clearTimeout(click.current); click.current = setTimeout(() => openPage(target), 200); },
    suppressClick: () => { skipClick.current = true; },
    changeName: (name: string) => setState(s => ({ ...s, name })), beginDrag, dragTo, endDrag,
    showMenu: (menu: string) => setState(s => ({ ...s, menu })), closeMenu: () => { options.current.get(state.menu)?.focus(); setState(s => ({ ...s, menu: '' })); },
    toggleMove: () => setState(s => ({ ...s, moveOpen: !s.moveOpen })), closeMove: () => { moveButton.current?.focus(); setState(s => ({ ...s, moveOpen: false })); },
    move: (target: string, selected: ReadonlySet<string>) => step(() => {
      const result = moveToPage(model.current, selected, target); if (!result.count) return;
      commit(result.board, true); select(''); setMessage(result.notice);
      setState(s => ({ ...s, moveOpen: false, open: false, menu: '', go: { id: target, text: result.notice } }));
    }), movedCount: (selected: ReadonlySet<string>) => movedSet(board, selected).size };
}
