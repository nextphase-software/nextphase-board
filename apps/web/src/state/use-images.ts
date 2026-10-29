// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type RefObject, type Dispatch, type SetStateAction } from "react";
import type { Board, BoardV10 } from "../document.ts";
import { isImage } from "../objects/registry.ts";
import { boardPictures, readPictures, storePicture, tabPictures } from "../image-assets.ts";
import { addImages, decodePicture, describeImage, descriptionDraft, IMAGE_ACCEPT, IMAGE_REASONS, importReason, platformPaste, prepareImage, refusalNotice, type PreparedImage } from "../images.ts";
import { signature } from "../image-assets.ts";
import type { LocalStore } from "../storage.ts";
import type { View } from "../view.ts";

type Input = {
  board: BoardV10; model: RefObject<BoardV10>; selected: Set<string>;
  readOnly: boolean; busy: boolean; composing: boolean; invalidObjectText: boolean;
  pending: RefObject<{ busy: boolean; composing: boolean; invalid: boolean }>;
  commit: (board: Board, recordObject?: boolean) => void; finishTextSession: () => void;
  select: (ids: string | Iterable<string>) => void; setTool: Dispatch<SetStateAction<string>>;
  setPanel: (value: string) => void; setInline: (value: boolean) => void;
  setComposing: (value: boolean) => void; setMessage: (value: string) => void;
  scene: RefObject<HTMLDivElement | null>; getView: () => View; getStore: () => LocalStore | null;
  isAlive: () => boolean; barVisible: () => boolean;
};
type Draft = { boardId: string; id: string; generation: string; value: string; composing: boolean; pending: boolean };
export function useImages(input: Input) {
  const latest = useRef(input); latest.current = input;
  const [importing, setImporting] = useState(false), running = useRef(false), epoch = useRef(0);
  const [bitmaps, setBitmaps] = useState<Map<string, ImageBitmap>>(() => new Map());
  const decoded = useRef(new Map<string, ImageBitmap>()), decoding = useRef(new Map<string, Promise<void>>());
  const openFor = useRef("");
  const draft = useRef<Draft | null>(null), [, redraw] = useState(0), [opened, setOpened] = useState(false);
  const field = useRef<HTMLTextAreaElement | null>(null), button = useRef<HTMLButtonElement | null>(null), control = useRef<HTMLSpanElement | null>(null);
  const selectedImage = input.selected.size === 1 ? input.board.objects.filter(isImage).find((o) => input.selected.has(o.id)) : undefined;
  const busy = input.busy || importing;
  input.pending.current.busy = busy;
  const unavailable = input.readOnly || busy || input.composing || input.invalidObjectText;
  const canImport = () => { const i = latest.current; return !running.current && !i.readOnly && !i.busy && !i.composing && !i.invalidObjectText && i.isAlive(); };
  function commitDescription() {
    const d = draft.current, i = latest.current;
    if (!d) return;
    if (d.composing) { d.pending = true; return; }
    draft.current = null;
    if (i.readOnly || i.busy || !i.isAlive()) return;
    i.commit(describeImage(i.model.current, d.boardId, d.id, d.generation, d.value), true);
  }
  function closeDescription(focus = false) {
    commitDescription(); setOpened(false); if (focus) button.current?.focus();
  }
  function changeDescription(value: string) {
    const i = latest.current;
    if (i.readOnly || i.busy || running.current) return;
    const o = i.selected.size === 1 ? i.model.current.objects.filter(isImage).find((o) => i.selected.has(o.id)) : undefined;
    if (!o) return;
    const valueDraft = descriptionDraft(value); if (valueDraft === null) return;
    const composing = draft.current?.composing ?? false;
    draft.current = { boardId: i.board.boardId, id: o.id, generation: o.generation, value: valueDraft, composing, pending: draft.current?.pending ?? false };
    redraw((n) => n + 1);
  }
  async function ensureDecoded(board: BoardV10) {
    const s = latest.current.getStore();
    if (s?.db) await readPictures(s.db, boardPictures(board));
    await Promise.all([...boardPictures(board)].map(async (hash) => {
      const p = tabPictures.get(hash); if (!p || decoded.current.has(hash)) return;
      let task = decoding.current.get(hash);
      if (!task) {
        task = decodePicture(p).then((bitmap) => { decoded.current.set(hash, bitmap); }).catch(() => {});
        decoding.current.set(hash, task);
      }
      await task;
    }));
    if (latest.current.isAlive()) setBitmaps(new Map(decoded.current));
  }
  useEffect(() => { void ensureDecoded(input.board).catch(() => {}); }, [input.board]);
  useEffect(() => {
    const d = draft.current;
    if (d && d.boardId !== input.board.boardId) { draft.current = null; setOpened(false); }
    else if (d && (d.id !== selectedImage?.id || !input.barVisible())) closeDescription();
    if (opened && (!input.barVisible() || openFor.current !== input.board.boardId + "/" + selectedImage?.id)) closeDescription();
  });
  useEffect(() => {
    const outside = (event: Event) => {
      if (event.target instanceof Node && !control.current?.contains(event.target)) closeDescription();
    };
    const hide = () => { epoch.current++; };
    document.addEventListener("pointerdown", outside, true); document.addEventListener("focusin", outside);
    window.addEventListener("pagehide", hide);
    return () => { epoch.current++; document.removeEventListener("pointerdown", outside, true); document.removeEventListener("focusin", outside); window.removeEventListener("pagehide", hide); };
  }, []);
  async function importFiles(files: readonly File[], centre: { x: number; y: number }) {
    if (!files.length || !canImport()) return;
    input.finishTextSession(); commitDescription();
    const boardId = input.model.current.boardId, token = epoch.current, s = input.getStore();
    running.current = true; setImporting(true); input.setInline(false);
    const accepted: PreparedImage[] = [], refused: { name: string; reason: string }[] = [];
    const stillOpen = () => latest.current.isAlive() && !latest.current.readOnly && latest.current.model.current.boardId === boardId && token === epoch.current && s?.active;
    try {
      for (const file of files) {
        if (!stillOpen()) return;
        try {
          const image = await prepareImage(file);
          if (!stillOpen()) return;
          const reason = importReason(latest.current.model.current, accepted, image); if (reason) throw Error(reason);
          try { if (!s?.db) throw Error(); await storePicture(s.db, image.hash, image.picture, s.transactions); }
          catch { throw Error(IMAGE_REASONS.store); }
          if (!stillOpen()) return;
          tabPictures.set(image.hash, image.picture); accepted.push(image);
        } catch (error) { refused.push({ name: file.name, reason: error instanceof Error ? error.message : IMAGE_REASONS.type }); }
      }
      if (!stillOpen()) return;
      const i = latest.current, before = i.model.current;
      if (accepted.length) {
        const next = addImages(before, accepted, centre), old = new Set(before.objects.map((o) => o.id));
        i.commit(next, true); i.select(next.objects.filter((o) => !old.has(o.id)).map((o) => o.id));
        i.setTool("Select"); i.setPanel(""); i.scene.current?.focus();
      }
      i.setMessage(refused.length ? refusalNotice(refused) : `Added ${accepted.length} ${accepted.length === 1 ? "image" : "images"}.`);
    } finally { running.current = false; if (latest.current.isAlive()) setImporting(false); }
  }
  const centre = () => { const v = latest.current.getView(); return { x: v.x, y: v.y }; };
  function chooseImages() {
    if (!canImport()) return;
    const field = document.createElement("input"); field.type = "file"; field.multiple = true; field.accept = IMAGE_ACCEPT;
    field.setAttribute("aria-label", "Choose images"); field.hidden = true;
    const clean = () => field.remove();
    field.addEventListener("change", () => { const files = Array.from(field.files ?? []); clean(); void importFiles(files, centre()); }, { once: true });
    field.addEventListener("cancel", clean, { once: true });
    document.body.append(field); field.click();
  }
  async function pasted(files: File[], paste: () => void) {
    if (!canImport()) return;
    if (!files.length) { paste(); return; }
    const boardId = latest.current.model.current.boardId, token = epoch.current;
    const signatures = await Promise.all(files.map(async (file) => {
      try { return file.type.startsWith("image/") || !!signature(await file.slice(0, 16).arrayBuffer()); } catch { return false; }
    }));
    if (!canImport() || latest.current.model.current.boardId !== boardId || epoch.current !== token) return;
    if (signatures.some(Boolean)) await importFiles(files, centre()); else paste();
  }
  const paste = (objectPaste: () => void) => (event: ClipboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.defaultPrevented || latest.current.composing) return;
    event.preventDefault(); return pasted(Array.from(event.clipboardData.files), objectPaste);
  };
  function dragOver(event: DragEvent<HTMLDivElement>) { event.preventDefault(); }
  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); if (!canImport()) return;
    const r = event.currentTarget.getBoundingClientRect(), v = latest.current.getView();
    return importFiles(Array.from(event.dataTransfer.files), { x: v.x + (event.clientX - r.left - r.width / 2) / v.z, y: v.y + (event.clientY - r.top - r.height / 2) / v.z });
  }
  const value = selectedImage && draft.current?.boardId === input.board.boardId && draft.current.id === selectedImage.id ? draft.current.value : selectedImage?.description ?? "";
  const description = {
    image: selectedImage, value, opened, field, button, control, disabled: input.readOnly || busy,
    toggle: () => { if (opened) closeDescription(); else { input.finishTextSession(); openFor.current = input.board.boardId + "/" + selectedImage?.id; setOpened(true); } },
    change: changeDescription, commit: commitDescription, close: () => closeDescription(true),
    focusField: (node: HTMLTextAreaElement | null) => { field.current = node; node?.focus(); },
    startComposition: () => {
      changeDescription(value); if (draft.current) draft.current.composing = true; input.setComposing(true);
    },
    endComposition: (value: string) => {
      changeDescription(value); input.setComposing(false);
      if (draft.current) { const pending = draft.current.pending; draft.current.composing = false; if (pending) commitDescription(); }
    },
  };
  const count = input.board.objects.filter(isImage).filter((o) => input.selected.has(o.id)).length;
  return { count, only: count > 0 && count === input.selected.size, importing, busy, bitmaps, description, chooseImages, paste, dragOver, drop,
    guardGesture: (event: { preventDefault: () => void; stopPropagation: () => void }) => { if (running.current) { event.preventDefault(); event.stopPropagation(); } },
    picker: { disabled: unavailable, choose: chooseImages, mac: platformPaste(navigator.platform) },
  };
}
