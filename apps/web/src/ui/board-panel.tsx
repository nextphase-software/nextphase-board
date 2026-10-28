// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, SetStateAction, RefObject } from "react";
import { count, validText, type Board as SavedBoard, type BoardV9 as Board } from "../document";
import type { BoardEntry } from "../board-catalog";
import { BoardsList } from "./boards-list";

type Props = {
  setComposing: Dispatch<SetStateAction<boolean>>;
  commit: (input: SavedBoard, recordObject?: boolean, orderIds?: readonly string[]) => void;
  model: RefObject<Board>;
  title: string;
  readOnly: boolean;
  busy: boolean;
  setTitle: Dispatch<SetStateAction<string>>;
  setStatus: Dispatch<SetStateAction<string>>;
  composing: boolean;
  reopen: () => void;
  setPanel: Dispatch<SetStateAction<string>>;
  boardButton: RefObject<HTMLButtonElement | null>;
  boardFiles: {
    entries: BoardEntry[]; heldLocks: string[]; boardKey: string; readOnly: boolean; opening: boolean; invalid: boolean;
    panelRef: (node: HTMLElement | null) => void;
    fileInput: RefObject<HTMLInputElement | null>; fileButton: RefObject<HTMLButtonElement | null>;
    openBoard: (entry: BoardEntry, element: HTMLElement) => void;
    openFile: (file: File) => void; saveCopy: () => void;
  };
};

export function BoardPanel({
  setComposing, commit, model, title, readOnly, busy, setTitle, setStatus, composing, reopen,
  setPanel, boardButton, boardFiles
}: Props) {
  return (
    <section className="details floating" ref={boardFiles.panelRef}>
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
        readOnly={readOnly || busy || boardFiles.opening}
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
      <div className="board-file-commands">
        <button onClick={boardFiles.saveCopy} disabled={boardFiles.invalid || busy || composing || boardFiles.opening}>Save a copy to file</button>
        <button ref={boardFiles.fileButton} onClick={() => boardFiles.fileInput.current?.click()}
          disabled={busy || composing || boardFiles.opening}>Open board file…</button>
      </div>
      <input hidden ref={boardFiles.fileInput} type="file" accept=".nextboard,.json" onChange={(e) => {
        const file = e.currentTarget.files?.[0]; e.currentTarget.value = "";
        if (file) boardFiles.openFile(file);
      }} />
      <button onClick={reopen} disabled={busy || composing || boardFiles.opening}>Reopen</button>
      <BoardsList {...boardFiles} busy={busy} composing={composing} />
      <p>
        Boards are kept only in this browser profile, and browser storage is not a backup. Save a copy to file to keep one.
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
  );
}
