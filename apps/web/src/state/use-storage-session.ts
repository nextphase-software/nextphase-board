// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { type Adapter, type Board as SavedBoard, type BoardV7 as Board, empty } from "../document";
import { decode, LocalStore, readPair } from "../storage";
import type { View } from "../view";

type Input = {
  readOnly: boolean;
  setReadOnly: Dispatch<SetStateAction<boolean>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setMessage: (value: string) => void;
  load: (input: SavedBoard) => void;
  clearHistory: () => void;
  model: RefObject<Board>;
  revision: RefObject<number>;
  adapter: RefObject<Adapter | null>;
  select: (value: string | Iterable<string>) => void;
  setInline: Dispatch<SetStateAction<boolean>>;
  setView: Dispatch<SetStateAction<View>>;
  invalid: boolean;
  busy: boolean;
  composing: boolean;
  pending: RefObject<{ invalid: boolean; composing: boolean; busy: boolean }>;
};

export function useStorageSession({
  readOnly, setReadOnly, setStatus, setMessage, load, clearHistory, model,
  revision, adapter, select, setInline, setView, invalid, busy, composing, pending,
}: Input) {
  const [snapshots, setSnapshots] = useState<{ board: SavedBoard; revision: number }[]>(
    [],
  );
  const ack = useRef(-1),
    store = useRef<LocalStore | null>(null),
    release = useRef<(() => void) | null>(null),
    alive = useRef(true),
    lockTask = useRef<Promise<void> | null>(null);
  function adopt(input: SavedBoard, saved: boolean) {
    load(input);
    select("");
    setInline(false);
    setView({ x: 0, y: 0, z: 1 });
    ack.current = saved ? 0 : -1;
    setStatus(saved ? "Locally saved" : "Unsaved");
  }
  async function start() {
    if (release.current || store.current) return;
    clearHistory();
    setReadOnly(true);
    setMessage("Checking local storage and writer ownership…");
    let own = false;
    let writerReason = "Another tab is editing. This board is read-only.";
    try {
      if (!navigator.locks) {
        writerReason = "Web Locks unavailable. This board is read-only; editing is disabled.";
      } else try {
        await new Promise<void>((resolve, reject) => {
        lockTask.current = navigator.locks.request(
          "nextphase-board/writer/v1",
          { mode: "exclusive", ifAvailable: true },
          async (lock) => {
            own = !!lock;
            if (!lock) {
              resolve();
              return;
            }
            await new Promise<void>((done) => {
              release.current = done;
              resolve();
            });
          },
        ).catch(reject);
        });
      } catch (error) {
        writerReason = "Writer ownership unavailable. This board is read-only. " + String(error);
      }
      const s = new LocalStore();
      store.current = s;
      const pair = await s.open(() => {
        clearHistory();
        setReadOnly(true);
        setMessage("Storage version changed. Reload explicitly to retry.");
        release.current?.();
        release.current = null;
      });
      try {
        const loaded = await readPair(pair);
        if (!alive.current) return;
        adopt(loaded?.board ?? empty(), !!loaded);
        setReadOnly(!own);
        setMessage(
          own
            ? "Stored only in this browser profile. Browser storage is not a backup."
            : writerReason,
        );
      } catch (error) {
        const valid = [];
        for (const raw of pair) {
          try {
            const x = await decode(raw);
            valid.push({
              board: x.board,
              revision: x.envelope.storageRevision,
            });
          } catch {}
        }
        setSnapshots(valid);
        setReadOnly(true);
        setMessage(
          "Saved data is unsupported, damaged or inconsistent. Original records are preserved. " +
            String(error),
        );
      }
    } catch (error) {
      setReadOnly(true);
      setMessage("Storage unavailable. " + String(error));
    }
  }
  useEffect(() => {
    alive.current = true;
    void start();
    const hide = () => {
      clearHistory();
      store.current?.close();
      store.current = null;
      release.current?.();
      release.current = null;
      setReadOnly(true);
    };
    const show = () => {
      if (!store.current) {
        setMessage(
          "Editing paused. Retry editing to reacquire ownership and reload.",
        );
      }
    };
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      alive.current = false;
      hide();
      adapter.current?.destroy();
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    };
  }, []);
  function save() {
    if (invalid || readOnly || busy || composing || !store.current) return;
    const captured = revision.current;
    setStatus("Saving");
    store.current.save(model.current, captured).then((receipt) => {
      ack.current = receipt.draftRevision;
      setStatus(
        revision.current === captured && !pending.current.invalid &&
          !pending.current.composing && !pending.current.busy
          ? "Locally saved"
          : "Unsaved",
      );
      setMessage(
        "Local revision " + receipt.storageRevision +
          " acknowledged after transaction completion.",
      );
    }).catch((error) => {
      setStatus("Save failed");
      setMessage(String(error));
      if (String(error).includes("changed")) {
        clearHistory();
        setReadOnly(true);
      }
    });
  }
  async function reopen() {
    if (composing || busy) return;
    if (
      (revision.current !== ack.current || invalid) &&
      !confirm("Discard unsaved drafts and reload the saved board?")
    ) return;
    clearHistory();
    store.current?.close();
    store.current = null;
    release.current?.();
    release.current = null;
    await lockTask.current;
    setSnapshots([]);
    await start();
  }
  return { snapshots, alive, adopt, save, reopen };
}
