// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { BoardV14 as Board } from 'nextphase-board-rules/document.ts';
import { addPage, deletePage, duplicatePage, duplicatePageReason, fallbackPage, movePage, movedSet, moveToPage, pageBoard, pageObjects, renamePage, PAGE_LIMIT } from '../pages';
import { fitView, freeArea, type View } from '../view';
import { objectBox, unionBoxes } from '../find';
import { editingCommandReason } from '../commands';
import {
  captureStartupPage, takeStartupPage, pageLink, resolvePage, COPY_PAGE_LINK,
  copiedPageNotice, clipboardRefused, missingPageNotice,
} from '../page-links.ts';
import type { ResolvedItem } from '../geometry';
import type { HostedBoard } from '../team/hosted-board';
import type { ChangeOrigin } from '../team/page-presence';

type Input = {
  board: Board; model: RefObject<Board>; stepPage: RefObject<string | undefined>; hosted: boolean; canEdit?: boolean; team?: HostedBoard;
  commit: (board: Board, record?: boolean, orderIds?: readonly string[], opens?: string, movedPages?: readonly string[]) => void; finishTextSession: () => void;
  select: (value: string | Iterable<string>) => void; setMessage: (value: string) => void;
  getView: () => View; setView: (view: View, following?: boolean) => void; getObjects: () => readonly ResolvedItem[];
  openingReason: () => string; editingReason: () => string;
};
type Drag = { id: string; y: number; active: boolean; gap: number };
const readOnlyReason = editingCommandReason({ readOnly: true, composing: false, pointerGesture: false, invalidObjectText: false });
export type Pages = ReturnType<typeof usePages>;
export const rememberedPageKey = (board: string) => `nextphase-board/page/v1/${board}`;
function remembered(board: Board): string {
  try { const id = localStorage.getItem(rememberedPageKey(board.boardId)); if (board.pages.some(p => p.id === id)) return id!; } catch { /* Optional browser preference. */ }
  return board.pages[0].id;
}
export function usePages(input: Input) {
  const { board, model, commit, finishTextSession, select, setMessage } = input;
  const [state, setState] = useState(() => ({ boardId: board.boardId, id: remembered(board), open: false,
    menu: '', editing: '', name: '', drag: null as Drag | null, moveOpen: false, go: null as { id: string; text: string } | null }));
  const views = useRef(new Map<string, View>()), button = useRef<HTMLButtonElement | null>(null), panel = useRef<HTMLElement | null>(null);
  const names = useRef(new Map<string, HTMLButtonElement>()), options = useRef(new Map<string, HTMLButtonElement>());
  const nameField = useRef<HTMLInputElement | null>(null), pageMenu = useRef<HTMLDivElement | null>(null), moveButton = useRef<HTMLButtonElement | null>(null), moveMenu = useRef<HTMLDivElement | null>(null);
  const latest = useRef({ state, input, finishName: (_keep: boolean) => {}, closeList: () => {} });
  latest.current = { state, input, finishName, closeList };
  const click = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), skipClick = useRef(false);
  const same = state.boardId === board.boardId;
  const id = same && board.pages.some(p => p.id === state.id) ? state.id : remembered(board);
  if (!same) { views.current.clear(); setState({ ...state, boardId: board.boardId, id, open: false, menu: '', editing: '', drag: null, moveOpen: false, go: null }); }
  const currentPage = useRef(id); currentPage.current = id;
  const preview = useRef<{ active: boolean; page?: string }>({ active: false });
  const arrival = useRef({ board: '', opening: input.hosted, localPlaceholder: input.hosted ? undefined : board,
    addressBoard: '', addressPage: '' });
  // Clear the local-only startup message before hosted chrome is measured.
  if (arrival.current.opening) { arrival.current.opening = false; setMessage(''); }
  const canEdit = input.canEdit !== false;
  if (input.team) {
    input.team.page = id;
    input.team.pageNotice = setMessage;
    input.team.openPage = (next, following = false) => openPage(next, false, next, following);
    if (arrival.current.board) input.team.onLinkedPage = openLinkedPage;
  }
  const editReason = () => !canEdit ? 'View only' : input.editingReason();
  input.stepPage.current = id;
  const focused = useRef({ open: false, menu: '', editing: '', moveOpen: false, canEdit });
  const closeEditorMenu = !canEdit && focused.current.canEdit;
  const transitionView = useRef<View | undefined>(undefined); transitionView.current = undefined;
  function remember(next: string, boardId = model.current.boardId) {
    try { localStorage.setItem(rememberedPageKey(boardId), next); } catch { /* Optional browser preference. */ }
  }
  function writeAddress(next: string, boardId = model.current.boardId) {
    if (input.team?.pendingPage) return;
    const link = pageLink(location.href, next, input.hosted ? boardId : undefined);
    history.replaceState(history.state, '', link);
    arrival.current.addressBoard = boardId;
    arrival.current.addressPage = next;
  }
  function showOpeningPage(next: Board, value: string | undefined, showNotice: boolean) {
    const { page, missing } = resolvePage(next.pages, value, remembered(next));
    const leaving = currentPage.current;
    currentPage.current = page.id;
    input.stepPage.current = page.id;
    setState(s => ({ ...s, boardId: next.boardId, id: page.id }));
    remember(page.id, next.boardId);
    writeAddress(page.id, next.boardId);
    if (input.team) {
      input.team.page = page.id;
      if (page.id !== leaving) input.team.pageChanged();
    }
    if (missing && showNotice) setMessage(missingPageNotice(page.name));
  }
  function openPage(next: string, force = false, fitSource = next, following = false): View | undefined {
    if (!force && input.openingReason() || !model.current.pages.some(p => p.id === next)) return;
    finishTextSession(); select('');
    const view = transitionView.current ?? input.getView();
    const leaving = currentPage.current; views.current.set(leaving, view);
    if (leaving !== next && !following) input.team?.stopFollowing();
    let target = views.current.get(next);
    if (!target) {
      const objects = input.getObjects().filter(o => o.page === fitSource), box = unionBoxes(objects.map(objectBox));
      const size = { w: window.innerWidth, h: window.innerHeight };
      const palette = document.querySelector('nav.palette')?.getBoundingClientRect();
      const navigation = document.querySelector('.navigation')?.getBoundingClientRect();
      target = box ? fitView(box, freeArea(size, palette?.top ?? size.h - 68, navigation?.left), size) : { x: 0, y: 0, z: 1 };
    }
    if (next !== leaving) { input.setView(target, following); transitionView.current = target; }
    setState(s => ({ ...s, id: next, menu: '', moveOpen: false }));
    remember(next);
    input.stepPage.current = next;
    currentPage.current = next;
    if (input.team) {
      input.team.page = next;
      if (next !== leaving) input.team.pageChanged();
    }
    if (next !== leaving) writeAddress(next);
    return next === leaving ? view : target;
  }
  function openLinkedPage(value?: string) {
    const current = currentPage.current;
    if (value !== undefined) {
      const reason = input.openingReason();
      if (reason) setMessage(reason);
      else {
        const { page, missing } = resolvePage(model.current.pages, value, currentPage.current);
        if (page.id !== currentPage.current) openPage(page.id);
        if (missing) setMessage(missingPageNotice(page.name));
      }
    }
    if (currentPage.current === current) writeAddress(current);
  }
  function closeList(focus = false) {
    if (focus || panel.current?.contains(document.activeElement) || pageMenu.current?.contains(document.activeElement)) button.current?.focus();
    setState(s => ({ ...s, open: false, menu: '', editing: '', drag: null }));
  }
  function focusName(next: string) { queueMicrotask(() => names.current.get(next)?.focus()); }
  function finishName(keep: boolean) {
    const current = latest.current.state, value = nameField.current?.value ?? current.name;
    if (!current.editing) return;
    if (keep && !editReason()) commit(renamePage(model.current, current.editing, value), true);
    setState(s => ({ ...s, editing: '' })); focusName(current.editing);
  }
  function rename(id: string) {
    clearTimeout(click.current);
    if (editReason()) return;
    setState(s => ({ ...s, menu: '', editing: id, name: model.current.pages.find(p => p.id === id)!.name }));
  }
  function step(action: () => void) {
    if (editReason()) return;
    finishTextSession();
    try { action(); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }
  function add() { step(() => {
    const result = addPage(model.current); commit(result.board, true, undefined, undefined, [result.page.id]); openPage(result.page.id, true);
    setState(s => ({ ...s, open: true, editing: result.page.id, name: result.page.name }));
  }); }
  async function copyPage(target: string) {
    const page = model.current.pages.find(p => p.id === target);
    if (!page) return;
    const link = pageLink(location.href, page.id, input.hosted ? model.current.boardId : undefined);
    let write: Promise<void> | undefined;
    try { write = navigator.clipboard?.writeText(link); } catch { /* The browser refused access. */ }
    closeList(true);
    const copied = write && await write.then(() => true, () => false);
    setMessage(copied ? copiedPageNotice(page.name, input.hosted) : clipboardRefused);
  }
  function choose(action: string, target: string) {
    if (action === COPY_PAGE_LINK) { void copyPage(target); return; }
    if (action === 'Delete page' && input.team?.votePageReason(target)) return;
    if (action === 'Rename page') { rename(target); return; }
    step(() => {
      if (action === 'Duplicate page') {
        const result = duplicatePage(model.current, target); commit(result.board, true, undefined, undefined, [result.page.id]); openPage(result.page.id, true, target); setMessage(result.notice);
      } else if (action === 'Delete page') {
        const result = deletePage(model.current, target, id); commit(result.board, true);
        if (result.open !== id) openPage(result.open, true);
        setMessage(result.notice);
      } else commit(movePage(model.current, target, model.current.pages.findIndex(p => p.id === target) + (action === 'Move up' ? -1 : 1)), true, undefined, undefined, [target]);
      closeList();
    });
  }
  // Both popovers share this listener and the single page state owner.
  useEffect(() => {
    if (!input.hosted) captureStartupPage(location.href);
    const outside = (event: PointerEvent) => {
      const target = event.target as Node, current = latest.current.state;
      if (current.editing && !nameField.current?.contains(target)) latest.current.finishName(true);
      if (current.open && !panel.current?.contains(target) && !pageMenu.current?.contains(target) && !button.current?.contains(target)) latest.current.closeList();
      if (current.moveOpen && !moveMenu.current?.contains(target) && !moveButton.current?.contains(target)) setState(s => ({ ...s, moveOpen: false }));
    };
    document.addEventListener('pointerdown', outside, true);
    const off = input.team?.subscribePresence(() => setState(s => ({ ...s })));
    return () => { off?.(); document.removeEventListener('pointerdown', outside, true); };
  }, []);
  // Focus after React has installed the new row or menu; no DOM state owns pages.
  useEffect(() => {
    const arrived = arrival.current;
    if (arrived.localPlaceholder && arrived.localPlaceholder !== board) {
      arrived.localPlaceholder = undefined;
      // The command reason exposes writer readiness after the storage load.
      showOpeningPage(board, takeStartupPage(), input.editingReason() !== readOnlyReason);
    } else if ((input.hosted ? arrived.board === board.boardId : !arrived.localPlaceholder)
      && (arrived.addressBoard !== board.boardId || arrived.addressPage !== id)) {
      writeAddress(id, board.boardId);
    }
    const live = (id: string) => board.pages.some(p => p.id === id);
    if ((!canEdit && (closeEditorMenu && state.menu || state.editing || state.drag || state.moveOpen)) || state.menu && !live(state.menu) || state.editing && !live(state.editing) || state.drag && !live(state.drag.id)) {
      setState(s => ({ ...s, menu: closeEditorMenu || !live(s.menu) ? '' : s.menu, editing: !canEdit || !live(s.editing) ? '' : s.editing, drag: !canEdit || s.drag && !live(s.drag.id) ? null : s.drag, moveOpen: canEdit && s.moveOpen })); return;
    }
    if (state.editing && editReason()) { setState(s => ({ ...s, editing: '' })); focusName(state.editing); return; }
    const previous = focused.current;
    focused.current = { open: state.open, menu: state.menu, editing: state.editing, moveOpen: state.moveOpen, canEdit };
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
  function beginDrag(target: string, y: number) { if (!editReason()) setState(s => ({ ...s, drag: { id: target, y, active: false, gap: model.current.pages.findIndex(p => p.id === target) } })); }
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
    if (!cancel && drag?.active) step(() => commit(movePage(model.current, drag.id, drag.gap), true, undefined, undefined, [drag.id]));
    return !!drag?.active;
  }
  function changed(before: Board, next: Board, change: ChangeOrigin, previewing = false) {
    const pending = input.team?.pendingPage;
    if (input.hosted && !previewing && (pending || change.origin === 'reload' && arrival.current.board !== next.boardId)) {
      arrival.current.board = next.boardId;
      preview.current.active = false;
      if (input.team) {
        input.team.pendingPage = undefined;
        input.team.onLinkedPage = openLinkedPage;
      }
      showOpeningPage(next, pending?.value, true);
      return;
    }
    const current = currentPage.current;
    let target: string | undefined;
    if (previewing && !preview.current.active) { preview.current = { active: true, page: current }; target = next.pages.some(p => p.id === current) ? current : next.pages[0].id; }
    else if (!previewing && preview.current.active) { target = next.pages.some(p => p.id === preview.current.page) ? preview.current.page : next.pages[0].id; preview.current.active = false; }
    else if (change.origin !== 'own') {
      const removed = input.team?.removedPage(before, next, current, change);
      if (removed) { target = removed.page; if (removed.notice) setMessage(removed.notice); }
    }
    if (target && target !== current) openPage(target, true, target, true);
    if (change.origin === 'own' && input.team?.historyPage) afterHistory(before, next, input.team.historyPage);
    arrival.current.board = next.boardId;
  }
  return { id, local: true, canEdit, changed, people: (page: string) => input.team?.pagePeople(page) ?? { shown: [], overflow: 0, name: '' },
    voteReason: (page: string) => input.team?.votePageReason(page) ?? '', list: board.pages, open: same && state.open, menu: closeEditorMenu ? '' : state.menu, editing: canEdit ? state.editing : '',
    name: state.name, drag: canEdit ? state.drag : null, moveOpen: canEdit && state.moveOpen, go: state.go, get openingReason() { return input.openingReason(); }, get editingReason() { return editReason(); },
    get addReason() { return editReason() || (board.pages.length >= 50 ? PAGE_LIMIT : ''); }, duplicateReason: (target: string) => editReason() || duplicatePageReason(board, target),
    button, panel, names, options, nameField, pageMenu, moveButton, moveMenu,
    objects: (value = board) => pageObjects(value, id), canvas: (value = board) => pageBoard(value, id),
    toggle: () => state.open ? closeList() : setState(s => ({ ...s, open: true })), closeList, openPage, add, rename, finishName, choose, afterHistory,
    clickPage: (target: string) => { if (skipClick.current) { skipClick.current = false; return; } clearTimeout(click.current); click.current = setTimeout(() => openPage(target), 200); },
    suppressClick: () => { skipClick.current = true; },
    changeName: (name: string) => setState(s => ({ ...s, name })), beginDrag, dragTo, endDrag,
    showMenu: (menu: string) => setState(s => ({ ...s, menu })), closeMenu: () => { options.current.get(state.menu)?.focus(); setState(s => ({ ...s, menu: '' })); },
    toggleMove: () => setState(s => ({ ...s, moveOpen: !s.moveOpen })), closeMove: () => { moveButton.current?.focus(); setState(s => ({ ...s, moveOpen: false })); },
    move: (target: string, selected: ReadonlySet<string>) => step(() => {
      if (input.team?.votePageReason(id)) return;
      const result = moveToPage(model.current, selected, target); if (!result.count) return;
      commit(result.board, true); select(''); setMessage(result.notice);
      setState(s => ({ ...s, moveOpen: false, open: false, menu: '', go: { id: target, text: result.notice } }));
    }), movedCount: (selected: ReadonlySet<string>) => movedSet(board, selected).size };
}
