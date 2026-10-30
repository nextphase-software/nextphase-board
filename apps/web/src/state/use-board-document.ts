// SPDX-License-Identifier: Apache-2.0
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { type Board as SavedBoard, type BoardV10 as Board, empty, type ItemV10 as Item, upgrade } from "nextphase-board-rules/document.ts";
import { Adapter } from "nextphase-board-sync/document-adapter.ts";
import { defaultConnectorStyle, type ConnectorStyle, defaultPaint, hasText, type ShapePaint } from "nextphase-board-rules/objects/registry.ts";
import { emptyHistory, record, type History } from "../history";

type Input = {
  readOnly: boolean;
  setStatus: Dispatch<SetStateAction<string>>;
};

export function useBoardDocument({ readOnly, setStatus }: Input) {
  const [board, setBoard] = useState<Board>(empty),
    [title, setTitle] = useState(""),
    [drafts, setDrafts] = useState<Record<string, string>>({}),
    [history, setHistory] = useState<History>(emptyHistory);
  const connectorStyle = useRef<ConnectorStyle>(defaultConnectorStyle());
  const shapePaint = useRef(defaultPaint());
  const shapeSession = { paint: shapePaint, update: (paint: ShapePaint) => { shapePaint.current = paint; } };
  const model = useRef(board),
    historyRef = useRef<History>(history),
    textSession = useRef<{ before: Board; id: string } | null>(null),
    revision = useRef(0),
    adapter = useRef<Adapter | null>(null);
  if (!adapter.current) adapter.current = new Adapter();
  function updateHistory(next: History) {
    historyRef.current = next;
    setHistory(next);
  }
  function clearHistory() {
    textSession.current = null;
    updateHistory(emptyHistory());
  }
  function beginTextSession(item: Item | undefined) {
    if (!item || !hasText(item) || readOnly || textSession.current?.id === item.id) return;
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
  function load(input: SavedBoard) {
    const b = upgrade(input);
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
    connectorStyle, shapeSession, board, setBoard, title, setTitle, drafts, setDrafts, history,
    model, historyRef, textSession, revision, adapter,
    updateHistory, clearHistory, beginTextSession, finishTextSession, commit, load,
  };
}
