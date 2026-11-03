// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState } from "react";
import { editedWords, roleWords, type BoardRow } from "./home-rules";
import type { MenuPosition } from "./home-menu";

function RenameField({ title, finish }: {
  title: string; finish: (title: string | null, previous: string, focus: boolean) => void;
}) {
  const [draft, setDraft] = useState(title);
  const previous = useRef(title), finished = useRef(false), composing = useRef(false);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { field.current?.focus(); field.current?.select(); }, []);
  function end(save: boolean, focus: boolean) {
    if (finished.current) return;
    finished.current = true;
    finish(save ? draft : null, previous.current, focus);
  }
  return <input ref={field} className="home-rename" aria-label="Board name" value={draft}
    onChange={(event) => setDraft(event.target.value)} onClick={(event) => event.stopPropagation()}
    onDoubleClick={(event) => event.stopPropagation()}
    onCompositionStart={() => { composing.current = true; }}
    onCompositionEnd={() => { composing.current = false; }}
    onBlur={() => end(true, false)} onKeyDown={(event) => {
      event.stopPropagation();
      if (event.nativeEvent.isComposing || composing.current) return;
      if (event.key === "Tab") { end(true, true); return; }
      if (event.key === "Enter" || event.key === "Escape") {
        event.preventDefault(); end(event.key === "Enter", true);
      }
    }} />;
}

export function HomeCard({ row, recent, selected, select, open, showMenu, renaming, endRename, rename }: {
  row: BoardRow; recent: boolean; selected: boolean; select: () => void; open: () => void;
  showMenu: (position: MenuPosition) => void; renaming: boolean;
  endRename: () => void; rename: (title: string, previous: string) => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  function finish(title: string | null, previous: string, focus: boolean) {
    endRename();
    if (title !== null) rename(title, previous);
    if (focus) card.current?.focus();
  }
  return <div ref={card} className="home-board-card" role="option" tabIndex={0}
    aria-label={row.title} aria-selected={selected} onFocus={select} onClick={select} onDoubleClick={open}
    onContextMenu={(event) => {
      if (renaming) return;
      event.preventDefault(); select(); card.current?.focus();
      showMenu({ point: { x: event.clientX, y: event.clientY }, opener: event.currentTarget });
    }} onKeyDown={(event) => {
      if (event.key === "Enter") { event.preventDefault(); open(); }
      else if (event.key === "ContextMenu" || event.shiftKey && event.key === "F10") {
        event.preventDefault();
        const box = event.currentTarget.getBoundingClientRect();
        showMenu({ point: { x: box.left + 24, y: box.top + 80 }, opener: event.currentTarget });
      }
    }}>
    <div className="home-board-tile"><b aria-hidden="true">N</b></div>
    <div className="home-board-details">
      <b className="home-type-mark" aria-hidden="true">N</b>
      {renaming ? <RenameField title={row.title} finish={finish} /> : <span className="home-board-name">{row.title}</span>}
      <small className="home-edited">{recent ? `${row.workspaceName} · ` : ""}{editedWords(row.editedAt)}</small>
      <span className="home-chip home-board-role">{roleWords[row.role]}</span>
    </div>
  </div>;
}
