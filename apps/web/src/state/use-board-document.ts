// SPDX-License-Identifier: Apache-2.0
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { type Board as SavedBoard, type BoardV13 as Board, empty, type ItemV13 as Item, upgrade } from "nextphase-board-rules/document.ts";
import { Adapter } from "nextphase-board-sync/document-adapter.ts";
import { defaultConnectorStyle, type ConnectorStyle, defaultPaint, hasText, type ShapePaint } from "nextphase-board-rules/objects/registry.ts";
import { emptyHistory, record, type History, type Step } from "../history";
import { layoutRoots, settle } from "../mind-map";

import type { HostedBoard } from "../team/hosted-board";

type Input = {
  hosted?: HostedBoard;
  nameSent?: (title: string) => void;
  readOnly: boolean;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useBoardDocument({ readOnly, setStatus, hosted, nameSent }: Input) {
  const [board, setBoard] = useState<Board>(empty),
    [title, setTitle] = useState(""),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [history, setHistory] = useState<History>(emptyHistory);
  const stepPage = useRef<string | undefined>(undefined);
  const connectorStyle = useRef<ConnectorStyle>(defaultConnectorStyle());
  const shapePaint = useRef(defaultPaint());
  const nameGroup = useRef<string | undefined>(undefined);
  const shapeSession = { paint: shapePaint, update: (paint: ShapePaint) => { shapePaint.current = paint; } };
  const model = useRef(board),
    historyRef = useRef<History>(history),
    textSession = useRef<{ before: Board; id: string; group?: string } | null>(null),
    // An add that opens its node's first text session: that session joins the add's step.
    pendingAdd = useRef<{ id: string; before: Board; step?: Step; group?: string } | null>(null),
    revision = useRef(0),
    adapter = useRef<Adapter | null>(null);
  if (!adapter.current) adapter.current = new Adapter();
  function updateHistory(next: History) {
    historyRef.current = next;
    setHistory(next);
  }
  function clearHistory() {
    nameGroup.current = undefined;
    textSession.current = null;
    pendingAdd.current = null;
    updateHistory(emptyHistory());
  }
  function beginTextSession(item: Item | undefined) {
    if (!item || !hasText(item) || readOnly || textSession.current?.id === item.id) return;
    finishTextSession();
    const added = pendingAdd.current?.id === item.id ? pendingAdd.current : null;
    pendingAdd.current = null;
    if (added && !hosted && added.step && historyRef.current.past.at(-1) === added.step) {
      updateHistory({ past: historyRef.current.past.slice(0, -1), future: historyRef.current.future });
    }
    textSession.current = { before: added && (hosted || added.step) ? added.before : model.current, id: item.id,
      ...(hosted ? { group: added?.group ?? crypto.randomUUID() } : {}) };
  }
  function finishTextSession() {
    const session = textSession.current;
    textSession.current = null;
    // Ending a node's text session lays its map out in the same step.
    if (session && !readOnly) {
      const objects = layoutRoots(model.current.objects, [session.id]);
      if (objects !== model.current.objects) apply({ ...model.current, objects }, session.group);
    }
    if (session && !hosted) updateHistory(record(historyRef.current, session.before, model.current, undefined, stepPage.current));
  }
  function beginNameEntry() {
    if (hosted && !readOnly) { finishTextSession(); nameGroup.current = crypto.randomUUID(); }
  }
  function finishNameEntry() { nameGroup.current = undefined; }
  // The commit lays out, on the document it commits, every map it changes,
  // except the map of a node whose text session is open (interaction v40).
  function commit(input: SavedBoard, recordObject = false, orderIds?: readonly string[], opens?: string, movedPages?: readonly string[]) {
    const raw = upgrade(input);
    if (readOnly) return;
    let next = settle(model.current, raw, textSession.current?.id);
    if (JSON.stringify(next) === JSON.stringify(model.current)) return;
    pendingAdd.current = null;
    let step: Step | undefined;
    if (recordObject) {
      finishTextSession();
      next = settle(model.current, raw);
      if (JSON.stringify(next) === JSON.stringify(model.current)) return;
      const prior = historyRef.current.past.at(-1);
      updateHistory(record(historyRef.current, model.current, next, orderIds, stepPage.current));
      if (historyRef.current.past.at(-1) !== prior) step = historyRef.current.past.at(-1);
    }
    const before = model.current, group = opens && hosted ? crypto.randomUUID() : undefined;
    if (!apply(next, group ?? nameGroup.current ?? textSession.current?.group, movedPages)) return;
    if (opens) pendingAdd.current = { id: opens, before, group, step: hosted ? undefined : step };
  }
  function apply(next: Board, group?: string, movedPages?: readonly string[]) {
    const titleChanged = next.title !== model.current.title;
    if (hosted && hosted.edit(next, group, movedPages, stepPage.current) !== true) return false;
    if (hosted && titleChanged) nameSent?.(next.title);
    model.current = next;
    adapter.current!.set(next);
    revision.current++;
    setBoard(next);
    setStatus("Unsaved");
    return true;
  }
  function load(input: SavedBoard) {
    const b = upgrade(input);
    pendingAdd.current = null;
    connectorStyle.current = defaultConnectorStyle();
    clearHistory();
    model.current = b;
    setBoard(b);
    adapter.current?.destroy();
    adapter.current = new Adapter();
    adapter.current.set(b);
    setTitle(b.title);
    setDrafts({});
    revision.current = 0;
  }
  return {
    stepPage, connectorStyle, shapeSession, board, setBoard, title, setTitle, drafts, setDrafts, history,
    model, historyRef, textSession, revision, adapter,
    updateHistory, clearHistory, beginTextSession, finishTextSession, beginNameEntry, finishNameEntry, commit, load,
  };
}
