// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState } from "react";
import type { ItemV12, VideoItem } from "nextphase-board-rules/document.ts";
import { isVideo } from "nextphase-board-rules/objects/registry.ts";
import { videoFrame, loadFailedNotice, VIDEO_CANNOT_PLAY, type VideoPlayerState } from "../video.ts";
import { downloadedVideo, holdVideo, tabVideos } from "../image-assets.ts";
import type { HostedBoard } from "../team/hosted-board";

const keptTimes = new Map<string, number>(), warned = new Set<string>();
let muted = false;
type Target = {
  opening: unknown; video: VideoItem; press: number; state: VideoPlayerState["state"]; time: number;
  percent: number; hasData: boolean; shown: boolean; full: boolean; pending: boolean;
};
type Download = {
  controller: AbortController; timers: Set<ReturnType<typeof setTimeout>>; target: Target; press: number;
};
type Input = {
  opening: unknown; boardId: string; objects: readonly ItemV12[]; selected: ReadonlySet<string>;
  bitmaps: ReadonlyMap<string, ImageBitmap>; pressedPlay?: { id: string; sequence: number };
  hosted?: HostedBoard; hidden: boolean; setMessage(text: string): void;
};
export function useVideoPlayback({ opening, boardId, objects, selected, bitmaps, pressedPlay, hosted, hidden, setMessage }: Input) {
  const one = selected.size === 1 && objects.find(o => selected.has(o.id));
  const video = one && isVideo(one) && videoFrame(one, bitmaps) ? one : undefined;
  const element = useRef<HTMLVideoElement | null>(null), ref = useRef((el: HTMLVideoElement | null) => { element.current = el; });
  const urls = useRef(new Map<string, string>()), downloads = useRef(new Map<string, Download>());
  const session = useRef<Target | undefined>(undefined), consumed = useRef<number | undefined>(undefined);
  const message = useRef(setMessage); message.current = setMessage;
  const [, refresh] = useState(0), draw = () => refresh(n => n + 1);
  const key = boardId + "/" + video?.id;
  if (!video) session.current = undefined;
  else if (session.current?.opening !== opening || session.current?.video.id !== video.id || session.current.video.asset !== video.asset) {
    session.current = { opening, video, press: 0, time: keptTimes.get(key) ?? 0, percent: 0, hasData: false,
      state: !hosted && !tabVideos.has(video.asset) ? "unavailable" : "paused", shown: false, full: false, pending: false };
  }
  const target = session.current, press = target?.press;
  if (pressedPlay && pressedPlay.sequence !== consumed.current) {
    consumed.current = pressedPlay.sequence;
    if (target?.video.id === pressedPlay.id) target.pending = true;
  }
  const current = (t: Target, p = t.press) => session.current === t && t.press === p;
  function cannotPlay(t: Target) {
    if (!current(t)) return;
    element.current?.pause(); t.pending = false; t.state = "paused"; t.shown = false;
    if (!warned.has(t.video.asset)) { warned.add(t.video.asset); message.current(VIDEO_CANNOT_PLAY); }
    draw();
  }
  function start(t: Target) {
    const el = element.current, p = t.press;
    if (!current(t) || !el || !t.hasData || !t.pending) return;
    t.pending = false;
    if (t.time >= t.video.durationMs) { el.currentTime = 0; t.time = 0; }
    void el.play().catch(error => {
      if (!current(t, p)) return;
      if (error?.name === "NotAllowedError" || error?.name === "AbortError") { t.state = "paused"; draw(); }
      else cannotPlay(t);
    });
  }
  function attach(t: Target) {
    const el = element.current, v = tabVideos.get(t.video.asset);
    if (!current(t) || !el || !v) return;
    let url = urls.current.get(t.video.asset);
    if (!url) { url = URL.createObjectURL(new Blob([v.bytes], { type: v.mime })); urls.current.set(t.video.asset, url); }
    el.muted = muted;
    if (el.src !== url) el.src = url;
    start(t);
  }
  async function transfer(entry: Download, hash: string) {
    const { controller, timers } = entry, signal = controller.signal;
    try {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const progress = (loaded: number, total: number) => {
          if (signal.aborted || !current(entry.target, entry.press)) return;
          entry.target.percent = total ? Math.min(99, Math.floor(100 * loaded / total)) : 0; draw();
        };
        try {
          progress(0, 0);
          const answer = await hosted!.pictures.downloadVideo(hash, progress, signal);
          if (signal.aborted) return;
          const v = answer.kind === "ok" && await downloadedVideo(answer.blob, hash, entry.target.video.durationMs);
          if (signal.aborted) return;
          if (v) {
            holdVideo(hash, v);
            if (current(entry.target, entry.press)) { entry.target.state = "paused"; attach(entry.target); draw(); }
            return;
          }
        } catch { if (signal.aborted) return; }
        if (attempt < 3) await new Promise<void>(resolve => {
          const done = () => { timers.delete(timer); signal.removeEventListener("abort", done); resolve(); };
          const timer = setTimeout(done, attempt * 1000); timers.add(timer); signal.addEventListener("abort", done, { once: true });
        });
        if (signal.aborted) return;
      }
      message.current(loadFailedNotice(entry.target.video.name));
      if (current(entry.target, entry.press)) { entry.target.state = "paused"; entry.target.pending = false; draw(); }
    } finally { if (downloads.current.get(hash) === entry) downloads.current.delete(hash); }
  }
  function play() {
    if (!target || !current(target) || target.state === "unavailable" || target.state === "loading") return;
    target.press++; target.pending = true;
    if (tabVideos.has(target.video.asset)) { attach(target); draw(); return; }
    if (!hosted) return;
    const hash = target.video.asset, running = downloads.current.get(hash);
    target.state = "loading"; target.percent = 0;
    if (running) { running.target = target; running.press = target.press; }
    else {
      const entry = { controller: new AbortController(), timers: new Set<ReturnType<typeof setTimeout>>(), target, press: target.press };
      downloads.current.set(hash, entry); void transfer(entry, hash);
    }
    draw();
  }
  const removeFull = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    if (!target || !element.current) return;
    const el = element.current, scene = el.closest(".scene") as HTMLElement | null;
    target.time = keptTimes.get(key) ?? 0;
    el.muted = muted;
    if (target.pending) play();
    else if (tabVideos.has(target.video.asset)) attach(target);
    draw();
    return () => {
      target.press++; target.pending = false;
      if (target.hasData) keptTimes.set(key, target.state === "ended" ? target.video.durationMs : Math.round(el.currentTime * 1000));
      el.pause(); el.removeAttribute("src"); el.load();
      if (document.fullscreenElement === el) { void document.exitFullscreen().catch(() => {}); scene?.focus(); }
      removeFull.current?.();
    };
  }, [opening, video?.id, video?.asset]);
  useEffect(() => {
    const end = (hide = false) => {
      for (const entry of downloads.current.values()) {
        for (const timer of entry.timers) clearTimeout(timer);
        entry.controller.abort(); entry.timers.clear();
      }
      downloads.current.clear();
      for (const url of urls.current.values()) URL.revokeObjectURL(url);
      urls.current.clear();
      const t = session.current;
      if (t && t.opening === opening) {
        t.press++; t.pending = false;
        const el = element.current;
        if (el && hide) {
          if (t.hasData) {
            t.time = t.state === "ended" ? t.video.durationMs : Math.round(el.currentTime * 1000);
            keptTimes.set(boardId + "/" + t.video.id, t.time);
          }
          el.pause(); el.removeAttribute("src"); el.load();
          if (document.fullscreenElement === el) void document.exitFullscreen().catch(() => {});
          t.hasData = false; t.shown = false; t.percent = 0;
          t.state = !hosted && !tabVideos.has(t.video.asset) ? "unavailable" : "paused"; draw();
        }
      }
    };
    const hide = () => end(true);
    window.addEventListener("pagehide", hide);
    return () => { window.removeEventListener("pagehide", hide); end(); };
  }, [opening]);
  if (!target || !video) return { player: undefined };
  const t = target, active = () => current(t, press);
  const seek = (ms: number) => {
    const el = element.current;
    if (!active() || !el || !t.hasData) return;
    t.time = Math.max(0, Math.min(t.video.durationMs, ms)); el.currentTime = t.time / 1000;
    if (t.state === "ended") t.state = "paused";
    draw();
  };
  const player: VideoPlayerState = {
    id: video.id, box: video, state: t.state, timeMs: t.time, durationMs: video.durationMs,
    percent: t.state === "loading" ? t.percent : 100 * t.time / video.durationMs,
    shown: t.shown && !hidden, hidden, fullScreen: t.full, muted, hasData: t.hasData,
    canFullScreen: typeof element.current?.requestFullscreen === "function", ref: ref.current,
    onLoadedMetadata() {
      const el = element.current;
      if (!active() || !el) return;
      el.currentTime = t.time / 1000; t.hasData = true; start(t); draw();
    },
    onLoadedData() { if (active() && t.hasData && t.time > 0) { t.shown = true; draw(); } },
    onTimeUpdate() {
      if (active() && t.hasData && element.current) { t.time = Math.min(video.durationMs, Math.round(element.current.currentTime * 1000)); draw(); }
    },
    onPlaying() { if (active()) { t.state = "playing"; t.shown = true; draw(); } },
    onPause() { if (active() && t.state === "playing") { t.state = "paused"; draw(); } },
    onEnded() { if (active()) { t.state = "ended"; t.time = video.durationMs; draw(); } },
    onError() { if (active()) cannotPlay(t); },
    play, pause() { if (active()) element.current?.pause(); }, seek,
    seekKey(key) {
      const delta = { ArrowUp: 5000, ArrowRight: 5000, ArrowDown: -5000, ArrowLeft: -5000 }[key];
      if (delta !== undefined) seek(t.time + delta);
      else if (key === "Home" || key === "End") seek(key === "Home" ? 0 : video.durationMs); else return false;
      return true;
    },
    toggleMute() { if (active()) { muted = !muted; if (element.current) element.current.muted = muted; draw(); } },
    enterFullScreen() {
      const el = element.current;
      if (!active() || !el?.requestFullscreen || !t.hasData) return;
      removeFull.current?.();
      const remove = () => { document.removeEventListener("fullscreenchange", changed); removeFull.current = undefined; };
      const changed = () => {
        if (!current(t)) return;
        t.full = document.fullscreenElement === el; el.controls = t.full; draw();
        if (t.full) el.focus();
        else { el.parentElement?.querySelector<HTMLButtonElement>('[aria-label="Full screen"]')?.focus(); remove(); }
      };
      removeFull.current = remove; document.addEventListener("fullscreenchange", changed);
      void el.requestFullscreen().catch(remove);
    },
  };
  return { player };
}
