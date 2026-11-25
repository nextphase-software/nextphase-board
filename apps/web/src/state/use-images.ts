// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type RefObject, type Dispatch, type SetStateAction } from "react";
import type { Board, BoardV14 } from "nextphase-board-rules/document.ts";
import { isMedia, isVideo } from "nextphase-board-rules/objects/registry.ts";
import { boardPictures, boardVideos, holdVideo, tabVideos, assetKind, isVideoKind, isPictureKind, readVideos, storeVideo, VIDEO_FILE_LIMIT, pictureHash, readPictures, signature, storePicture, tabPictures, type Picture } from "../image-assets.ts";
import { mediaLabel, addedNotice, prepareVideo } from "../video.ts";
import { addImages, addingNotice, HOSTED_REASONS, decodePicture, describeImage, descriptionDraft, MEDIA_ACCEPT, IMAGE_REASONS, VIDEO_REASONS, importReason, platformPaste, prepareImage, refusalNotice, type PreparedMedia } from "../images.ts";
import type { HostedBoard } from "../team/hosted-board";
import { gifInfo } from "../gif.ts";
import { isCanvasPasteTarget } from "../table-csv.ts";
import type { LocalStore } from "../storage.ts";
import type { View } from "../view.ts";

type Input = {
  hosted?: HostedBoard;
  page: string;
  board: BoardV14; model: RefObject<BoardV14>; selected: Set<string>;
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
// Own one queue and retry budget per board opening. A failed attempt releases
// its slot immediately, even while its retry timer is pending.
function hostedLoader(hosted: HostedBoard, boardId: string, current: () => boolean,
  loaded: (hash: string, picture: Picture, bitmap: ImageBitmap) => void, pending: (hashes: Set<string>) => void) {
  const queue: string[] = [], waiting = new Set<string>(), tries = new Map<string, number>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let active = 0, ended = false;
  const live = () => !ended && current();
  const publish = () => { if (live()) pending(new Set(waiting)); };
  async function request(hash: string) {
    const attempt = (tries.get(hash) ?? 0) + 1;
    tries.set(hash, attempt);
    try {
      const bytes = await hosted.pictures.download(hash);
      if (!live()) return;
      if (!bytes || await pictureHash(bytes) !== hash) throw Error();
      const mime = signature(bytes);
      if (!mime) throw Error();
      const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
      if (!live()) { bitmap.close(); return; }
      loaded(hash, { bytes, mime, pixelWidth: bitmap.width, pixelHeight: bitmap.height }, bitmap);
      waiting.delete(hash);
    } catch {
      if (!live()) return;
      if (attempt === 3) waiting.delete(hash);
      else {
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (live()) { queue.push(hash); pump(); }
        }, attempt * 1000);
        timers.add(timer);
      }
    } finally { active--; publish(); pump(); }
  }
  function pump() {
    while (live() && active < 4 && queue.length) { active++; void request(queue.shift()!); }
  }
  return { hosted, boardId, add(hashes: Set<string>) {
    for (const hash of hashes) if (!tabPictures.has(hash) && !tries.has(hash)) {
      tries.set(hash, 0); waiting.add(hash); queue.push(hash);
    }
    publish(); pump();
  }, end() { ended = true; for (const timer of timers) clearTimeout(timer); } };
}
export function useImages(input: Input) {
  const latest = useRef(input); latest.current = input;
  const [importing, setImporting] = useState<false | "pictures" | "with-videos">(false), running = useRef(false), epoch = useRef(0);
  const [bitmaps, setBitmaps] = useState<Map<string, ImageBitmap>>(() => new Map());
  const decoded = useRef(new Map<string, ImageBitmap>()), decoding = useRef(new Map<string, Promise<void>>());
  const animation = useRef(new Set<string>()), loader = useRef<ReturnType<typeof hostedLoader> | null>(null);
  const [loading, setLoading] = useState<ReadonlySet<string>>(new Set());
  const openFor = useRef("");
  const draft = useRef<Draft | null>(null), [, redraw] = useState(0), [opened, setOpened] = useState(false);
  const field = useRef<HTMLTextAreaElement | null>(null), button = useRef<HTMLButtonElement | null>(null), control = useRef<HTMLSpanElement | null>(null);
  const selectedImage = input.selected.size === 1 ? input.board.objects.filter(isMedia).find((o) => input.selected.has(o.id)) : undefined;
  const busy = input.busy || !!importing;
  input.pending.current.busy = busy;
  const unavailable = input.readOnly || input.hosted?.canEdit === false || busy || input.composing || input.invalidObjectText;
  const canImport = () => { const i = latest.current; return !running.current && !i.readOnly && i.hosted?.canEdit !== false && !i.busy && !i.composing && !i.invalidObjectText && i.isAlive(); };
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
    const o = i.selected.size === 1 ? i.model.current.objects.filter(isMedia).find((o) => i.selected.has(o.id)) : undefined;
    if (!o) return;
    const valueDraft = descriptionDraft(value); if (valueDraft === null) return;
    const composing = draft.current?.composing ?? false;
    draft.current = { boardId: i.board.boardId, id: o.id, generation: o.generation, value: valueDraft, composing, pending: draft.current?.pending ?? false };
    redraw((n) => n + 1);
  }
  async function ensureDecoded(board: BoardV14) {
    const { hosted } = latest.current, hashes = boardPictures(board);
    if (loader.current && (loader.current.hosted !== hosted || loader.current.boardId !== board.boardId)) {
      loader.current.end(); loader.current = null; setLoading(new Set());
    }
    function remember(hash: string, picture: Picture, bitmap: ImageBitmap) {
      decoded.current.set(hash, bitmap);
      if (picture.mime === "image/gif") {
        const info = gifInfo(picture.bytes);
        if (info && info.frames >= 2 && info.width === bitmap.width && info.height === bitmap.height) animation.current.add(hash);
      }
    }
    if (hosted) {
      loader.current ??= hostedLoader(hosted, board.boardId,
        () => latest.current.hosted === hosted && latest.current.board.boardId === board.boardId,
        (hash, picture, bitmap) => {
          tabPictures.set(hash, picture); remember(hash, picture, bitmap); setBitmaps(new Map(decoded.current));
        }, setLoading);
      loader.current.add(hashes);
    } else {
      const s = latest.current.getStore();
      if (s?.db) { await readPictures(s.db, hashes); await readVideos(s.db, boardVideos(board)); }
    }
    await Promise.all([...hashes].map(async (hash) => {
      const p = tabPictures.get(hash); if (!p || decoded.current.has(hash)) return;
      let task = decoding.current.get(hash);
      if (!task) {
        task = decodePicture(p).then((bitmap) => { remember(hash, p, bitmap); }).catch(() => {});
        decoding.current.set(hash, task);
      }
      await task;
    }));
    if (latest.current.isAlive()) setBitmaps(new Map(decoded.current));
  }
  useEffect(() => { void ensureDecoded(input.board).catch(() => {}); }, [input.board, input.hosted]);
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
    const hide = () => { epoch.current++; loader.current?.end(); loader.current = null; };
    document.addEventListener("pointerdown", outside, true); document.addEventListener("focusin", outside);
    window.addEventListener("pagehide", hide);
    return () => { hide(); document.removeEventListener("pointerdown", outside, true); document.removeEventListener("focusin", outside); window.removeEventListener("pagehide", hide); };
  }, []);
  async function importFiles(files: readonly File[], centre: { x: number; y: number }, preRead?: ReadonlyMap<File, ArrayBuffer>) {
    if (!files.length || !canImport()) return;
    input.finishTextSession(); commitDescription();
    const boardId = input.model.current.boardId, token = epoch.current, hosted = input.hosted;
    const store = hosted ? null : input.getStore();
    running.current = true; setImporting("pictures"); input.setInline(false);
    const names = files.map(f => ({ name: f.name, video: false }));
    const batch = files.reduce((sum, f) => sum + f.size, 0);
    let done = 0, lastProgress = -Infinity, withVideos = false;
    const accepted: PreparedMedia[] = [], acceptedIndexes: number[] = [], reasons = new Map<number, string>();
    let offline = false, stopped = false;
    function check() {
      const i = latest.current;
      stopped ||= !i.isAlive() || i.model.current.boardId !== boardId || token !== epoch.current || i.hosted !== hosted;
      if (hosted) {
        stopped ||= hosted.snapshot.role === "viewer" || hosted.history.previewing || hosted.history.locked;
        offline ||= !hosted.snapshot.connected || hosted.history.rejoining || !hosted.canEdit;
      } else stopped ||= i.readOnly || !store?.active;
      return !stopped && !offline;
    }
    const unsubscribe = hosted?.subscribe(check);
    try {
      if (hosted) input.setMessage(addingNotice(files));
      for (const [index, file] of files.entries()) {
        if (!check()) break;
        try {
          if (file.size > VIDEO_FILE_LIMIT) throw Error(file.type?.startsWith("image/") ? IMAGE_REASONS.file : VIDEO_REASONS.file);
          let bytes: ArrayBuffer;
          try { bytes = preRead?.get(file) ?? await file.arrayBuffer(); } catch { throw Error(IMAGE_REASONS.type); }
          if (!check()) break;
          const kind = assetKind(bytes);
          if (!isVideoKind(kind) && !isPictureKind(kind)) {
            throw Error(file.size > 20971520 && file.type?.startsWith("image/") ? IMAGE_REASONS.file : IMAGE_REASONS.type);
          }
          if (isVideoKind(kind)) {
            names[index].video = true;
            if (!withVideos) {
              withVideos = true; setImporting("with-videos");
              if (!hosted) input.setMessage(addingNotice(names));
            }
          }
          const image = isVideoKind(kind) ? await prepareVideo(file, bytes, kind.video) : await prepareImage(file, bytes);
          if (!check()) break;
          const reason = importReason(latest.current.model.current, accepted, image, tabPictures, hosted ? null : tabVideos);
          if (reason) throw Error(hosted && reason === IMAGE_REASONS.bytes ? HOSTED_REASONS.full : reason);
          if (!check()) break;
          const [hash, picture] = "video" in image ? [image.posterHash, image.poster] : [image.hash, image.picture];
          if (hosted) {
            const result = await hosted.pictures.upload(hash, picture.bytes);
            if (!check()) break;
            if (!result.ok) throw Error("video" in image && result.kind === "too_large" ? HOSTED_REASONS.refused : HOSTED_REASONS[result.kind]);
            if ("video" in image) {
              const progress = (loaded: number, total: number) => {
                if (!check() || Date.now() - lastProgress < 250) return;
                lastProgress = Date.now();
                const percent = batch ? Math.min(99, Math.floor(100 * (done + (total ? file.size * loaded / total : 0)) / batch)) : 0;
                input.setMessage(addingNotice(names, percent));
              };
              progress(0, file.size);
              const result = await hosted.pictures.uploadVideo(image.hash, file, progress);
              if (!check()) break;
              if (result !== "ok") throw Error(result === "network" ? HOSTED_REASONS.offline : result === "too_large" ? HOSTED_REASONS.video_too_large : HOSTED_REASONS[result]);
            }
          } else {
            try {
              if (!store?.db) throw Error();
              if ("video" in image) await storeVideo(store.db, image.hash, image.video, hash, picture, store.transactions);
              else await storePicture(store.db, hash, picture, store.transactions);
            } catch { throw Error("video" in image ? VIDEO_REASONS.store : IMAGE_REASONS.store); }
            if (!check()) break;
          }
          if ("video" in image) holdVideo(image.hash, image.video);
          tabPictures.set(hash, picture); accepted.push(image); acceptedIndexes.push(index);
        } catch (error) {
          const reason = error instanceof Error ? error.message : IMAGE_REASONS.type;
          reasons.set(index, hosted && reason === IMAGE_REASONS.file ? HOSTED_REASONS.too_large : hosted && reason === VIDEO_REASONS.file ? HOSTED_REASONS.video_too_large : hosted && reason === VIDEO_REASONS.play ? HOSTED_REASONS.video_play : reason);
        } finally { done += file.size; }
      }
      check();
      if (stopped) { if (hosted) input.setMessage(""); return; }
      const i = latest.current, before = i.model.current;
      if (offline) {
        for (const index of files.keys()) if (!reasons.has(index)) reasons.set(index, HOSTED_REASONS.offline);
        accepted.length = 0;
      } else if (hosted) {
        const room = Math.max(0, 250 - before.objects.length);
        for (const index of acceptedIndexes.slice(room)) reasons.set(index, IMAGE_REASONS.objects);
        accepted.splice(room);
      }
      if (accepted.length) {
        const next = addImages(before, accepted, centre, i.page), old = new Set(before.objects.map(o => o.id));
        i.commit(next, true); i.select(next.objects.filter(o => !old.has(o.id)).map(o => o.id));
        i.setTool("Select"); i.setPanel(""); i.scene.current?.focus();
      }
      const refused = names.flatMap((file, index) => reasons.has(index) ? [{ ...file, reason: reasons.get(index)! }] : []);
      i.setMessage(refused.length ? refusalNotice(refused) : hosted ? "" : addedNotice(accepted.filter(item => "picture" in item).length, accepted.filter(item => "video" in item).length));
    } finally { unsubscribe?.(); running.current = false; if (latest.current.isAlive()) setImporting(false); }
  }
  const centre = () => { const v = latest.current.getView(); return { x: v.x, y: v.y }; };
  function chooseImages() {
    if (!canImport()) return;
    const field = document.createElement("input"); field.type = "file"; field.multiple = true; field.accept = MEDIA_ACCEPT;
    field.setAttribute("aria-label", "Choose images or videos"); field.hidden = true;
    const clean = () => field.remove();
    field.addEventListener("change", () => { const files = Array.from(field.files ?? []); clean(); void importFiles(files, centre()); }, { once: true });
    field.addEventListener("cancel", clean, { once: true });
    document.body.append(field); field.click();
  }
  async function pasted(files: File[], paste: () => void) {
    if (!canImport()) return;
    if (!files.length) { paste(); return; }
    const boardId = latest.current.model.current.boardId, token = epoch.current;
    const preRead = new Map<File, ArrayBuffer>(), taken: File[] = [];
    for (const file of files) {
      if (/^(image|video)\//.test(file.type)) taken.push(file);
      else if (file.size <= VIDEO_FILE_LIMIT) {
        try {
          const bytes = await file.arrayBuffer();
          preRead.set(file, bytes);
          if (assetKind(bytes)) taken.push(file);
        } catch { /* An unreadable untyped file is not media. */ }
      }
    }
    if (!canImport() || latest.current.model.current.boardId !== boardId || epoch.current !== token) return;
    if (taken.length) await importFiles(taken, centre(), preRead); else paste();
  }
  const paste = (objectPaste: () => void) => (event: ClipboardEvent<HTMLDivElement>) => {
    if (!isCanvasPasteTarget(event) || event.defaultPrevented || latest.current.composing) return;
    event.preventDefault(); return pasted(Array.from(event.clipboardData.files), objectPaste);
  };
  function dragOver(event: DragEvent<HTMLDivElement>) { event.preventDefault(); }
  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault(); if (!canImport()) return;
    const r = event.currentTarget.getBoundingClientRect(), v = latest.current.getView();
    return importFiles(Array.from(event.dataTransfer.files), { x: v.x + (event.clientX - r.left - r.width / 2) / v.z, y: v.y + (event.clientY - r.top - r.height / 2) / v.z });
  }
  const value = selectedImage && draft.current?.boardId === input.board.boardId && draft.current.id === selectedImage.id ? draft.current.value : selectedImage?.description ?? "";
  const selectedMedia = input.board.objects.filter(isMedia).filter(o => input.selected.has(o.id));
  const count = selectedMedia.length, videos = selectedMedia.filter(isVideo).length;
  const description = {
    label: mediaLabel(count - videos, videos),
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
  return { loading, animated: animation.current, pasted, count, only: count > 0 && count === input.selected.size, importing, busy, bitmaps, description, chooseImages, paste, dragOver, drop,
    guardGesture: (event: { preventDefault: () => void; stopPropagation: () => void }) => { if (running.current) { event.preventDefault(); event.stopPropagation(); } },
    picker: { disabled: unavailable, choose: chooseImages, mac: platformPaste(navigator.platform) },
  };
}
