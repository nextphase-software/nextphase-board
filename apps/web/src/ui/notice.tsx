// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, SetStateAction } from "react";
import { placementTool } from "nextphase-board-rules/objects/registry.ts";
import type { Board as SavedBoard } from "nextphase-board-rules/document.ts";

type Props = {
  hosted?: boolean;
  importing?: boolean;
  pages: import("../find").Pages;
  showNotice: boolean;
  visibleMessage: string;
  invalidFields: string[];
  busy: boolean;
  tool: string;
  readOnly: boolean;
  snapshots: { board: SavedBoard; revision: number }[];
  reopen: () => void;
  composing: boolean;
  adopt: (input: SavedBoard, saved: boolean) => void;
  setReadOnly: Dispatch<SetStateAction<boolean>>;
  setMessage: (value: string) => void;
};

export function Notice({
  showNotice, visibleMessage, invalidFields, busy, tool, readOnly, snapshots, reopen, composing,
  adopt, setReadOnly, setMessage, pages, hosted, importing
}: Props) {
  if (importing && hosted) return <aside className="notice" role="status" hidden={!showNotice}>{visibleMessage}</aside>;
  return (
    <aside className="notice" role="status" hidden={!showNotice}>
      {visibleMessage}
      {pages.go?.text === visibleMessage && pages.list.some(p => p.id === pages.go?.id) && <button disabled={!!pages.openingReason} onClick={() => pages.openPage(pages.go!.id)}>Go to {pages.list.find(p => p.id === pages.go!.id)!.name}</button>}
      {invalidFields.map((s) => <div key={s}>{s}</div>)}
      {busy && (
        <div>
          Gesture in progress. Save, selection and view controls are paused
          until release or cancellation.
        </div>
      )}
      {placementTool(tool) && (
        <div>
          {placementTool(tool)?.draws ? "Drag to draw, click or press Enter to place one" : "Click empty canvas or press Enter to place one"} {tool.toLowerCase()}
          {" "}
          object. Escape cancels.
        </div>
      )}
      {!hosted && readOnly && !snapshots.length && (
        <button onClick={reopen}>Retry editing</button>
      )}
      {snapshots.map((s) => (
        <button
          key={s.revision}
          disabled={busy || composing}
          onClick={() => {
            adopt(s.board, true);
            setReadOnly(true);
            setMessage(
              "Viewing valid snapshot revision " + s.revision +
                " · read-only. Original saved records are preserved.",
            );
          }}
        >
          View valid snapshot {s.revision}
        </button>
      ))}
    </aside>
  );
}
