// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { type Adapter, type Board as SavedBoard, type BoardV10 as Board, empty, freshIdentifier } from "../document";
import { decode, LocalStore, readPair } from "../storage";
import { boardKeys, isBoardKey, LIST_KEY, orderedBoards, parseList, recordBoardKey, type BoardEntry } from "../board-catalog";
import { boardFileName, readBoardBundle, writeBoardFile } from "../board-file";
import type { View } from "../view";

import { boardPictures, readPictures, pictureBytes, PICTURE_LIMIT, tabPictures, type Pictures } from "../image-assets.ts";
import { decodePicture } from "../images.ts";

type Input = {
  readOnly: boolean;
  title: string;
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
type Target = { key: string; name: string } | { board: SavedBoard; name: string; pictures: Pictures };
type Ownership = { release: () => void; task: Promise<void> };
const OPEN_KEY = "nextphase-board/open/v1";

export function useStorageSession({
  readOnly, setReadOnly, setStatus, setMessage, load, clearHistory, model,
  revision, adapter, select, setInline, setView, invalid, busy, composing, pending, title,
}: Input) {
  const [snapshots, setSnapshots] = useState<{ board: SavedBoard; revision: number }[]>([]);
  const [entries, setEntries] = useState<BoardEntry[]>([]), [heldLocks, setHeldLocks] = useState<string[]>([]);
  const [key, setKey] = useState("original"), [opening, setOpening] = useState(true);
  const [question, setQuestion] = useState<Target | null>(null), [answerPending, setAnswerPending] = useState(false);
  const ack = useRef(-1), store = useRef<LocalStore | null>(null), ownership = useRef<Ownership | null>(null);
  const alive = useRef(true), currentKey = useRef("original"), opened = useRef<SavedBoard | undefined>(undefined);
  const operation = useRef(false), epoch = useRef(0), questionTarget = useRef<Target | null>(null);
  const incoming = useRef<{ store: LocalStore | null; own: Ownership } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null), fileInput = useRef<HTMLInputElement | null>(null);
  const pendingOpenFocus = useRef<HTMLElement | null>(null);
  const fileButton = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef((node: HTMLDialogElement | null) => {
    if (node && !node.open) {
      node.showModal(); node.querySelector<HTMLButtonElement>(".primary")?.focus();
    }
  });
  const panelOpen = useRef(false), timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const latest = useRef({ readOnly, invalid, busy, composing });
  latest.current = { readOnly, invalid, busy, composing };

  function adopt(input: SavedBoard, saved: boolean) {
    load(input); select(""); setInline(false); setView({ x: 0, y: 0, z: 1 });
    opened.current = structuredClone(input);
    ack.current = saved ? 0 : -1;
    setStatus(saved ? "Locally saved" : "Unsaved");
  }
  async function acquire(boardKey: string): Promise<Ownership | null> {
    if (!navigator.locks) return null;
    let release!: () => void;
    let granted!: (own: boolean) => void;
    const ready = new Promise<boolean>((resolve) => { granted = resolve; });
    const task = navigator.locks.request(boardKeys(boardKey).lock, { mode: "exclusive", ifAvailable: true }, async (lock) => {
      if (!lock) { granted(false); return; }
      await new Promise<void>((resolve) => { release = resolve; granted(true); });
    });
    task.catch(() => granted(false));
    return await ready ? { release, task } : null;
  }
  function remember(boardKey: string) {
    for (const name of ["sessionStorage", "localStorage"] as const) {
      try { window[name].setItem(OPEN_KEY, boardKey); } catch {}
    }
    const address = new URL(location.href); address.searchParams.set("board", boardKey);
    history.replaceState(null, "", address);
  }
  async function lockStatus() {
    try {
      const state = await navigator.locks?.query();
      const ownLock = ownership.current ? boardKeys(currentKey.current).lock : null;
      const names = [...new Set((state?.held ?? []).map((lock) => lock.name ?? "").filter((name) => name !== ownLock))].sort();
      if (alive.current) setHeldLocks((previous) =>
        previous.length === names.length && previous.every((name, index) => name === names[index]) ? previous : names);
    } catch { if (alive.current) setHeldLocks((previous) => previous.length ? [] : previous); }
  }
  async function refresh() {
    const s = store.current;
    try {
      const list = await s?.refreshList();
      if (alive.current && s === store.current && list) setEntries(orderedBoards(list));
    } catch {} // An advisory list failure never revokes editing.
    await lockStatus();
  }
  const actions = useRef({ refresh, lockStatus }); actions.current = { refresh, lockStatus };
  const panelRef = useRef((node: HTMLElement | null) => {
    panelOpen.current = !!node;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (node) {
      void actions.current.refresh();
      timer.current = setInterval(() => { void actions.current.lockStatus(); }, 1000);
    }
  });
  async function stop() {
    const s = store.current, own = ownership.current;
    store.current = null; ownership.current = null;
    s?.close();
    await s?.tail;
    own?.release(); await own?.task;
  }
  async function start(boardKey: string, supplied?: Ownership) {
    const token = epoch.current;
    clearHistory(); setReadOnly(true); setSnapshots([]);
    setMessage("Checking local storage and writer ownership…");
    let own = supplied;
    try {
      own ??= await acquire(boardKey) ?? undefined;
      if (!alive.current || token !== epoch.current) { own?.release(); return; }
      ownership.current = own ?? null;
      const s = new LocalStore(undefined, boardKey); store.current = s;
      const pair = await s.open(() => {
        epoch.current++; clearHistory(); setReadOnly(true);
        setMessage("Storage version changed. Reload explicitly to retry.");
        ownership.current?.release(); ownership.current = null;
      });
      if (!alive.current || token !== epoch.current) { s.close(); own?.release(); return; }
      if (boardKey !== "original" && pair.every((raw) => raw === undefined)) {
        await stop(); return start("original");
      }
      currentKey.current = boardKey; setKey(boardKey); remember(boardKey);
      try {
        const loaded = await readPair(pair, boardKey);
        if (!alive.current || token !== epoch.current) return;
        adopt(loaded?.board ?? empty(), !!loaded); setReadOnly(!own);
        setMessage(own ? "Stored only in this browser profile. Browser storage is not a backup."
          : navigator.locks ? "Another tab is editing. This board is read-only."
          : "Web Locks unavailable. This board is read-only; editing is disabled.");
      } catch (error) {
        if (!alive.current || token !== epoch.current) return;
        adopt(empty(), false);
        const valid = [];
        for (const raw of pair) {
          try { const x = await decode(raw); valid.push({ board: x.board, revision: x.envelope.storageRevision }); } catch {}
        }
        setSnapshots(valid); setReadOnly(true);
        setMessage("Saved data is unsupported, damaged or inconsistent. Original records are preserved. " + String(error));
      }
      await refresh();
    } catch (error) {
      setReadOnly(true); setMessage("Storage unavailable. " + String(error));
    }
  }
  useEffect(() => {
    alive.current = true;
    let choice = new URL(location.href).searchParams.get("board");
    if (!isBoardKey(choice)) {
      try { choice = sessionStorage.getItem(OPEN_KEY); } catch {}
    }
    if (!isBoardKey(choice)) {
      try { choice = localStorage.getItem(OPEN_KEY); } catch {}
    }
    operation.current = true;
    void start(isBoardKey(choice) ? choice : "original").finally(() => { operation.current = false; setOpening(false); });
    const hide = () => {
      epoch.current++; clearHistory(); void stop(); setReadOnly(true);
      const next = incoming.current; incoming.current = null;
      next?.store?.close();
      void (next?.store?.tail ?? Promise.resolve()).then(() => next?.own.release());
    };
    const show = () => {
      if (!store.current) setMessage("Editing paused. Retry editing to reacquire ownership and reload.");
    };
    const focus = () => { if (panelOpen.current) void actions.current.refresh(); };
    window.addEventListener("pagehide", hide); window.addEventListener("pageshow", show); window.addEventListener("focus", focus);
    return () => {
      alive.current = false; hide(); adapter.current?.destroy();
      if (timer.current) clearInterval(timer.current);
      window.removeEventListener("pagehide", hide); window.removeEventListener("pageshow", show); window.removeEventListener("focus", focus);
    };
  }, []);
  useEffect(() => {
    if (opening) return;
    const element = pendingOpenFocus.current;
    pendingOpenFocus.current = null;
    element?.focus();
  }, [opening]);
  async function save() {
    if (operation.current || latest.current.invalid || latest.current.readOnly || latest.current.busy || latest.current.composing || !store.current) return false;
    const captured = revision.current, s = store.current;
    const snapshot = structuredClone(model.current);
    setStatus("Saving");
    try {
      const receipt = await s.save(snapshot, captured);
      if (s !== store.current || !alive.current) return false;
      ack.current = receipt.draftRevision; opened.current = snapshot;
      const clean = revision.current === captured && !pending.current.invalid && !pending.current.composing && !pending.current.busy;
      setStatus(clean ? "Locally saved" : "Unsaved");
      setMessage("Local revision " + receipt.storageRevision + " acknowledged after transaction completion.");
      await refresh(); return clean;
    } catch (error) {
      if (s !== store.current || !alive.current) return false;
      setStatus("Save failed"); setMessage(String(error));
      if (String(error).includes("changed")) { clearHistory(); setReadOnly(true); }
      return false;
    }
  }
  async function reopen() {
    if (latest.current.composing || latest.current.busy || operation.current) return;
    if ((revision.current !== ack.current || latest.current.invalid) && !confirm("Discard unsaved drafts and reload the saved board?")) return;
    pendingOpenFocus.current = null;
    operation.current = true; setOpening(true); setReadOnly(true);
    await stop(); await start(currentKey.current);
    operation.current = false; setOpening(false);
  }
  function focusBack() { requestAnimationFrame(() => returnFocus.current?.focus()); }
  async function openTarget(target: Target) {
    const token = epoch.current;
    pendingOpenFocus.current = null;
    operation.current = true; setOpening(true);
    if ("key" in target) {
      setReadOnly(true); await stop(); await start(target.key);
    } else {
      let own: Ownership | null = null, created: LocalStore | null = null;
      try {
        if (!store.current) throw Error("Storage unavailable");
        // Observe identities without repairing the list: a failed creation must
        // leave even advisory records unchanged.
        const records = await store.current.records(), list = parseList(records.get(LIST_KEY));
        const ids = new Set(list.flatMap((e) => [e.key, e.boardId]));
        for (const [record, raw] of records) {
          ids.add(recordBoardKey(record));
          try {
            const envelope = typeof raw === "string" ? JSON.parse(raw) : null;
            const document = typeof envelope?.payload === "string" ? JSON.parse(envelope.payload) : null;
            if (isBoardKey(document?.boardId)) ids.add(document.boardId);
          } catch {}
        }
        ids.add(model.current.boardId);
        const id = freshIdentifier(target.board, [...ids].filter((value): value is string => value !== null));
        own = await acquire(id); if (!own) throw Error("Writer unavailable");
        if (!alive.current || token !== epoch.current) throw Error("Session closed");
        incoming.current = { store: null, own };
        const board = { ...target.board, boardId: id };
        created = new LocalStore(undefined, id); incoming.current.store = created;
        await created.open(() => {});
        if (!alive.current || token !== epoch.current) throw Error("Session closed");
        await created.create(board, target.pictures); created.close();
        for (const [hash, picture] of target.pictures) tabPictures.set(hash, picture);
        if (!alive.current || token !== epoch.current) throw Error("Session closed");
        incoming.current = null;
        setReadOnly(true); await stop();
        if (!alive.current || token !== epoch.current) throw Error("Session closed");
        const transferred = own; own = null; await start(id, transferred);
        setMessage(`Opened “${target.name}” as a new board in this browser. Your other boards are unchanged.`);
      } catch {
        incoming.current = null;
        created?.close(); own?.release(); await own?.task;
        if (alive.current && token === epoch.current) {
          setMessage(`“${target.name}” was not opened: the board could not be saved in this browser. Nothing changed.`);
        }
      }
    }
    operation.current = false; pendingOpenFocus.current = returnFocus.current;
    setOpening(false); setAnswerPending(false);
  }
  function ask(target: Target, element: HTMLElement | null) {
    returnFocus.current = element;
    if (revision.current !== ack.current || latest.current.invalid) {
      questionTarget.current = target; setQuestion(target);
    } else void openTarget(target);
  }
  function openBoard(entry: BoardEntry, element: HTMLElement) {
    if (operation.current || busy || composing || entry.key === currentKey.current || entry.state !== "valid") return;
    ask({ key: entry.key, name: entry.title || "Unnamed board" }, element);
  }
  async function openFile(file: File) {
    if (operation.current || busy || composing) return;
    const focus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pendingOpenFocus.current = null;
    operation.current = true; setOpening(true);
    let board: SavedBoard, pictures: Pictures;
    try {
      const bundle = await readBoardBundle(file); board = bundle.board; pictures = bundle.pictures;
      if (bundle.fileVersion === 1) {
        pictures = new Map(tabPictures);
        if (store.current?.db) await readPictures(store.current.db, boardPictures(board), pictures);
        if (pictureBytes(board, pictures) > PICTURE_LIMIT) throw Error("its pictures exceed the 50 MiB board limit");
      } else for (const picture of pictures.values()) {
        try { (await decodePicture(picture)).close(); } catch { throw Error("it is damaged"); }
      }
    }
    catch (error) {
      setMessage(`“${file.name}” was not opened: ${error instanceof Error ? error.message : "it is not a Board file"}. Nothing changed.`);
      operation.current = false; pendingOpenFocus.current = focus;
      setOpening(false); return;
    }
    operation.current = false; setOpening(false);
    ask({ board, pictures, name: file.name }, fileButton.current);
  }
  async function answer(value: "cancel" | "discard" | "save") {
    if (answerPending || operation.current || !questionTarget.current) return;
    if (value === "save" && (invalid || busy || composing || readOnly)) return;
    if (value === "cancel") { questionTarget.current = null; setQuestion(null); focusBack(); return; }
    const target = questionTarget.current; setAnswerPending(true);
    if (value === "save" && (!await save() || revision.current !== ack.current || pending.current.invalid || pending.current.busy || pending.current.composing)) {
      questionTarget.current = null; setQuestion(null); setAnswerPending(false); focusBack(); return;
    }
    questionTarget.current = null; setQuestion(null); await openTarget(target);
  }
  async function saveCopy() {
    if (invalid || busy || composing || operation.current) return;
    try {
      const board = structuredClone(model.current), unchanged = revision.current === ack.current ? opened.current : undefined;
      if (store.current?.db) await readPictures(store.current.db, boardPictures(unchanged ?? board));
      for (const hash of boardPictures(unchanged ?? board)) {
        const picture = tabPictures.get(hash);
        if (!picture) throw Error("a picture is unavailable");
        try { (await decodePicture(picture)).close(); } catch { throw Error("a picture is unavailable"); }
      }
      const raw = await writeBoardFile(board, unchanged);
      const url = URL.createObjectURL(new Blob([raw], { type: "application/octet-stream" }));
      const link = document.createElement("a"); link.href = url; link.download = boardFileName(board.title);
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) { setMessage("Could not save a copy to file: " + (error instanceof Error ? error.message : String(error)) + "."); }
  }
  return { store, snapshots, alive, adopt, save, reopen,
    boardFiles: { entries, heldLocks, boardKey: key, readOnly, opening, invalid, panelRef: panelRef.current,
      fileInput, fileButton, openBoard, openFile, saveCopy },
    boardQuestion: { question, boardName: title || "Unnamed board", answerPending,
      saveUnavailable: invalid || busy || composing || readOnly, answer, dialog: dialog.current },
  };
}
