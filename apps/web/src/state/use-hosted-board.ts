// SPDX-License-Identifier: Apache-2.0
import { useEffect, type ClipboardEvent, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { BoardV14 } from "nextphase-board-rules/document.ts";
import type { HostedBoard } from "../team/hosted-board";

import { isTable, cellText } from "nextphase-board-rules/objects/registry.ts";
import type { TableItem } from "nextphase-board-rules/document.ts";
import { rebaseComposition, validTableSelection, type TableSelection, type TableEntry } from "../table";

type Input = { hosted?: HostedBoard; model: RefObject<BoardV14>; load: (board: BoardV14) => void;
  setBoard: Dispatch<SetStateAction<BoardV14>>; setReadOnly: Dispatch<SetStateAction<boolean>>;
  setTitle: Dispatch<SetStateAction<string>>;
  setDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setTool: Dispatch<SetStateAction<string>>; setInline: Dispatch<SetStateAction<boolean>>;
  tables?: {
    selection?: TableSelection; entry: TableEntry;
    choose: (s: TableSelection, t: TableItem) => void;
    setMessage: (text: string) => void;
    cancelDrag: () => void;
    focus: () => void;
    finish: () => void;
    endComposition: () => void;
  };
  onChange?: (before: BoardV14, after: BoardV14, change: HostedBoard["change"], preview: boolean) => void;
  select: (value: string) => void; paste: () => void; composing: boolean };
export function useHostedBoard({ hosted, model, load, setBoard, setTitle, setReadOnly, setDrafts, setTool, setInline, select, paste, composing, tables, onChange = () => {} }: Input) {
  if (hosted) {
    hosted.onPageChange = onChange;
    hosted.keepTableSelection = !!tables?.selection;
    hosted.onTableChange = (before, after, change, preview) => {
      if (!tables || preview) return;
      if (hosted.historyTable && change.origin === "own") {
        select(after.objects.some(o => o.id === hosted.historyTable) ? hosted.historyTable : "");
        return;
      }
      const selection = tables.selection;
      if (!selection || change.origin === "own") return;
      const old = before.objects.find(o => o.id === selection.id);
      const next = after.objects.find(o => o.id === selection.id);
      const table = next && isTable(next) && old?.page === next.page ? next : undefined;
      const draft = tables.entry.draft;
      const label = hosted.presence.others.find(p => p.connection === change.connection)?.label;
      const result = validTableSelection(table, selection, !!draft, change.origin, label);
      if (!result.selection || result.selection !== selection) {
        if (draft || composing) tables.focus();
        tables.cancelDrag();
        tables.finish();
        setInline(false);
        tables.endComposition();
        if (result.selection && table) tables.choose(result.selection, table);
        else select("");
        if (result.notice) tables.setMessage(result.notice);
      } else if (draft && table && old && isTable(old) && cellText(old, draft.cell) !== cellText(table, draft.cell)) {
        const live = cellText(table, draft.cell), composition = tables.entry.composition.current;
        if (composition) {
          composition.offset = rebaseComposition(composition.base, live, composition.offset, "").caret;
          composition.base = live;
          composition.changed = true;
        } else tables.entry.setDraft({ ...draft, text: live });
      }
    };
  }
  useEffect(() => {
    if (!hosted) return;
    let generation = "", panEpoch = -1;
    const changed = () => {
      if (hosted.unavailable) {
        load({ ...model.current, title:"Untitled", objects:[], retiredGenerations:[] });
        setTitle(""); setDrafts({}); select(""); setTool("Select"); setInline(false); setReadOnly(true); return;
      }
      const before = model.current;
      const board = hosted.paintBoard, nextGeneration = `${hosted.snapshot.generation}:${hosted.history.paintEpoch}`;
      if (board && generation !== nextGeneration) {
        load(board);
        if (!generation || !hosted.keepTableSelection || hosted.history.previewing || before.boardId !== board.boardId) select("");
        generation = nextGeneration;
      }
      else if (board && JSON.stringify(board) !== JSON.stringify(model.current)) {
        if (board.title !== model.current.title) setTitle(board.title);
        model.current = board; setBoard(board); setDrafts({});
      }
      if (board && board !== before) {
        hosted.onPageChange?.(before, board, hosted.change, hosted.history.previewing);
        hosted.onTableChange?.(before, board, hosted.change, hosted.history.previewing);
        hosted.historyPage = undefined; hosted.historyTable = undefined;
      }
      setReadOnly(!hosted.canEdit);
      if (panEpoch !== hosted.history.panEpoch && hosted.history.panEpoch > 0) { setTool("Pan"); setInline(false); panEpoch = hosted.history.panEpoch; }
      if (!hosted.canEdit && !hosted.history.previewing && !hosted.history.locked && !hosted.panReturning) { setTool((tool) => tool === "Comment" || hosted.history.panEpoch > 0 && tool === "Pan" ? tool : "Select"); setInline(false); }
    };
    changed();
    return hosted.subscribe(changed);
  // This runs after the earlier canvas readOnly cancellation effect. A new
  // preview handoff reasserts Pan after that ordinary cancellation chooses Select.
  }, [hosted, hosted?.history.panEpoch]);
  return hosted ? (event: ClipboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.defaultPrevented || composing) return;
    event.preventDefault();
    if (!event.clipboardData.files.length) paste();
  } : undefined;
}
