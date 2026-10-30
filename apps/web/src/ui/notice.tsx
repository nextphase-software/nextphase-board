// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, SetStateAction } from "react";
import { placementTool } from "nextphase-board-rules/objects/registry.ts";
import type { Board as SavedBoard } from "nextphase-board-rules/document.ts";

type Props = {
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
  adopt, setReadOnly, setMessage
}: Props) {
  return (
    <aside className="notice" role="status" hidden={!showNotice}>
      {visibleMessage}
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
      {readOnly && !snapshots.length && (
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
