// SPDX-License-Identifier: Apache-2.0
import type { CSSProperties } from "react";
import { currentText, lengthText, type VideoPlayerState } from "../video.ts";

export function VideoPlayer({ player: p, pos, zoom }: {
  player?: VideoPlayerState; pos(point: { x: number; y: number }): { left: number; top: number }; zoom: number;
}) {
  if (!p) return null;
  const w = p.box.width * zoom, width = Math.max(120, w - 16), narrow = w < 240;
  const playing = p.state === "playing", loading = p.state === "loading";
  const time = currentText(p.timeMs, p.durationMs), total = lengthText(p.durationMs);
  return <div className={"video-player" + (p.hidden ? " concealed" : "")} style={{ ...pos(p.box), width: w, height: p.box.height * zoom }}>
    <video key={p.id} ref={p.ref} playsInline preload="auto" aria-hidden={p.fullScreen ? undefined : true} controls={p.fullScreen}
      className={p.shown ? "shown" : undefined} muted={p.muted} onLoadedMetadata={p.onLoadedMetadata} onLoadedData={p.onLoadedData}
      onTimeUpdate={p.onTimeUpdate} onPlaying={p.onPlaying} onPause={p.onPause} onEnded={p.onEnded} onError={p.onError} />
    <div className={"video-strip" + (narrow ? " narrow" : "")} role="group" aria-label="Video controls" style={{ width, left: (w - width) / 2 }}
      onPointerDown={e => e.stopPropagation()} onKeyDown={e => {
        if (e.key === "Escape") { e.stopPropagation(); e.currentTarget.closest<HTMLElement>(".scene")?.focus(); }
        else if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && /^(Arrow(Left|Right|Down|Up)|Home|End|PageUp|PageDown| |Enter|Delete|Backspace)$/.test(e.key)) e.stopPropagation();
      }}>
      <button className="video-play" aria-label={playing ? "Pause" : "Play"} disabled={p.state === "unavailable"} onClick={playing ? p.pause : p.play}>
        <svg aria-hidden="true" width="14" height="16" viewBox="0 0 14 16" fill="white">{playing
          ? <><rect x="1" y="1" width="4" height="14" rx="1"/><rect x="9" y="1" width="4" height="14" rx="1"/></>
          : <path d="M1 1 13 8 1 15Z"/>}</svg>
      </button>
      <span className="video-time">{loading ? "Loading video… " + p.percent + "%" : <>{time}<span className="video-total"> / {total}</span></>}</span>
      {!narrow && <>
        <span className="video-seek-box" style={{ "--fill": p.percent + "%" } as CSSProperties}>
          <span className="video-track"/><span className="video-fill"/>
          {!loading && <input className="video-seek" type="range" min={0} max={p.durationMs} step={1} value={p.timeMs}
            aria-label="Seek" aria-valuetext={time + " of " + total} disabled={!p.hasData} onChange={e => p.seek(+e.target.value)}
            onKeyDown={e => { if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && p.seekKey(e.key)) e.preventDefault(); }}/>}
        </span>
        <button className="video-button" aria-label={p.muted ? "Unmute" : "Mute"} onClick={p.toggleMute}>
          <svg aria-hidden="true" width="18" height="16" viewBox="0 0 18 16" fill="none" stroke="white" strokeWidth="1.6">
            <path d="M2 6h3l4-3v10L5 10H2Z" fill="white"/><path d={p.muted ? "M12 5.5l4 5M16 5.5l-4 5" : "M12 5.5a3.5 3.5 0 0 1 0 5M14.5 3a7 7 0 0 1 0 10"}/>
          </svg>
        </button>
        {p.canFullScreen && <button className="video-button" aria-label="Full screen" disabled={!p.hasData} onClick={p.enterFullScreen}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.6"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>
        </button>}
      </>}
    </div>
  </div>;
}
