// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { ResolvedItem } from '../geometry';
import { fadedIds, findCounter, findResults, objectBox, queryCursor, reconcileCursor, removedMessage,
  sectionsList, stepResult, unionBoxes, type FindActions, type FindCursor, type FindResult } from '../find';
import { fitView, freeArea, showView, type View } from '../view';

type Input = {
  boardId: string; displayedObjects: readonly ResolvedItem[]; selected: ReadonlySet<string>;
  select: (value: string | Iterable<string>) => void; view: View; setView: Dispatch<SetStateAction<View>>;
  size: { w: number; h: number }; scene: RefObject<HTMLDivElement | null>;
  composing: boolean; busy: boolean; tidy: { open: boolean }; finishTextSession: () => void;
  setInline: Dispatch<SetStateAction<boolean>>;
};

export function useFind({ boardId, displayedObjects, selected, select, view, setView, size, scene,
  composing, busy, tidy, finishTextSession, setInline }: Input): FindActions {
  const [session, setSession] = useState({ boardId, open: false, query: '', cursor: queryCursor([]) });
  const input = useRef<{ focus(): void; select(): void } | null>(null);
  const field = useCallback((element: { focus(): void; select(): void } | null) => {
    input.current = element;
    if (element) { element.focus(); element.select(); }
  }, []);
  const sameBoard = session.boardId === boardId, open = sameBoard && session.open;
  const results = open ? findResults(displayedObjects, session.query) : [];
  const cursor = open ? reconcileCursor(results, session.cursor) : session.cursor;
  // Reconcile during rendering, rather than a second effect or a stale frame of rings.
  if (!sameBoard) setSession({ ...session, boardId, open: false, cursor: queryCursor([]) });
  else if (cursor !== session.cursor) setSession({ ...session, cursor });
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘F' : 'Ctrl+F';

  function geometry() {
    const canvas = scene.current!;
    const rect = canvas.getBoundingClientRect();
    const dimensions = { w: canvas.clientWidth, h: canvas.clientHeight };
    const palette = document.querySelector('nav.palette')?.getBoundingClientRect();
    const panel = document.querySelector('.navigation')?.getBoundingClientRect();
    return { dimensions, area: freeArea(dimensions, palette ? palette.top - rect.top : size.h - 68,
      panel ? panel.left - rect.left : undefined) };
  }
  function move(box: FindResult | ReturnType<typeof unionBoxes>, fit = false) {
    if (!box || !scene.current) return;
    const { dimensions, area } = geometry();
    const next = fit ? fitView(box, area, dimensions) : showView(box, view, area, dimensions);
    if (next !== view) setView(next);
  }
  function choose(next: FindCursor) {
    setSession({ ...session, open: true, cursor: next });
    if (next.current) move(next.current);
  }
  function show() {
    if (composing || tidy.open) return;
    finishTextSession(); setInline(false);
    if (open) { input.current?.focus(); input.current?.select(); return; }
    choose(queryCursor(findResults(displayedObjects, session.query)));
  }
  function close() {
    setSession({ ...session, open: false, cursor: queryCursor([]) });
    if (cursor.current) select(cursor.current.id);
    scene.current?.focus();
  }
  function changeQuery(query: string) {
    const next = queryCursor(findResults(displayedObjects, query));
    setSession({ ...session, query, cursor: next });
    if (next.current) move(next.current);
  }
  function step(direction: -1 | 1) { if (results.length) choose(stepResult(results, cursor, direction)); }
  const allBox = unionBoxes(displayedObjects.map(objectBox));
  const selectionBox = unionBoxes(displayedObjects.filter(o => selected.has(o.id)).map(objectBox));
  const sections = sectionsList(displayedObjects);
  const latest = useRef({ show, composing, tidy });
  latest.current = { show, composing, tidy };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const mac = /Mac|iPhone|iPad/.test(navigator.platform);
      if (event.key.toLowerCase() !== 'f' || event.altKey || !(mac ? event.metaKey : event.ctrlKey)) return;
      event.preventDefault(); event.stopPropagation();
      if (event.isComposing || latest.current.composing || latest.current.tidy.open) return;
      latest.current.show();
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, []);
  return { open, query: session.query, results, cursor, faded: fadedIds(displayedObjects, results, selected),
    counter: findCounter(session.query, results, cursor), removed: removedMessage(results, cursor), shortcut,
    field, changeQuery, show, close, step, sections, canFit: !!allBox, canFitSelection: !!selectionBox,
    zoomToFit: () => { if (!busy && !composing && !tidy.open) move(allBox, true); },
    zoomToSelection: () => { if (!busy && !composing && !tidy.open) move(selectionBox, true); },
    fitSection: id => { if (!busy && !composing && !tidy.open) move(sections.find(s => s.id === id) ?? null, true); } };
}
