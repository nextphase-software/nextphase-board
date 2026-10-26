// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, SetStateAction, RefObject } from "react";
import { count, validText, type Board as SavedBoard, type BoardV5 as Board } from "../document";

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
};

export function BoardPanel({
  setComposing, commit, model, title, readOnly, busy, setTitle, setStatus, composing, reopen,
  setPanel, boardButton
}: Props) {
  return (
    <section className="details floating">
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
        readOnly={readOnly || busy}
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
      <button onClick={reopen} disabled={busy || composing}>Reopen</button>
      <p>
        One board in this browser origin/profile. Browser storage is not a
        backup.
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
