// SPDX-License-Identifier: Apache-2.0
import { useEffect, type ClipboardEvent, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { BoardV10 } from "nextphase-board-rules/document.ts";
import type { HostedBoard } from "../team/hosted-board";

type Input = { hosted?: HostedBoard; model: RefObject<BoardV10>; load: (board: BoardV10) => void;
  setBoard: Dispatch<SetStateAction<BoardV10>>; setReadOnly: Dispatch<SetStateAction<boolean>>;
  setTitle: Dispatch<SetStateAction<string>>;
  setDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setTool: Dispatch<SetStateAction<string>>; setInline: Dispatch<SetStateAction<boolean>>;
  select: (value: string) => void; paste: () => void; composing: boolean };
export function useHostedBoard({ hosted, model, load, setBoard, setTitle, setReadOnly, setDrafts, setTool, setInline, select, paste, composing }: Input) {
  useEffect(() => {
    if (!hosted) return;
    let generation = -1;
    const changed = () => {
      const { board, generation: nextGeneration } = hosted.snapshot;
      if (board && generation !== nextGeneration) { load(board); select(""); generation = nextGeneration; }
      else if (board && JSON.stringify(board) !== JSON.stringify(model.current)) {
        if (board.title !== model.current.title) setTitle(board.title);
        model.current = board; setBoard(board); setDrafts({});
      }
      setReadOnly(!hosted.canEdit);
      if (!hosted.canEdit) { setTool((tool) => tool === "Comment" ? tool : "Select"); setInline(false); }
    };
    changed();
    return hosted.subscribe(changed);
  }, [hosted]);
  return hosted ? (event: ClipboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.defaultPrevented || composing) return;
    event.preventDefault();
    if (!event.clipboardData.files.length) paste();
  } : undefined;
}
