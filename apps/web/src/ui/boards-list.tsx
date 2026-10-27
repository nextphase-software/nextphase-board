// SPDX-License-Identifier: Apache-2.0
import { boardKeys, boardStatus, type BoardEntry } from "../board-catalog";

type Props = {
  entries: BoardEntry[]; boardKey: string; heldLocks: string[]; readOnly: boolean;
  opening: boolean; busy: boolean; composing: boolean;
  openBoard: (entry: BoardEntry, element: HTMLElement) => void;
};
export function BoardsList({ entries, boardKey, heldLocks, readOnly, opening, busy, composing, openBoard }: Props) {
  return <>
    <h2 className="boards-heading">Boards in this browser</h2>
    <div className="boards-list">
      {entries.map((entry) => {
        const current = entry.key === boardKey;
        const another = heldLocks.includes(boardKeys(entry.key).lock);
        return <button key={entry.key} aria-current={current ? "true" : undefined}
          aria-disabled={!current && entry.state !== "valid" ? "true" : undefined}
          disabled={opening || busy || composing} onClick={(e) => openBoard(entry, e.currentTarget)}>
          <span>{entry.title || "Unnamed board"}</span>
          <small>{boardStatus(entry, current, another, readOnly)}</small>
        </button>;
      })}
    </div>
  </>;
}
