// SPDX-License-Identifier: Apache-2.0
import { LINK_WORDS, type LinkBarModel } from "../text-links";

const paths = {
  link: ["M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1", "M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"],
  "copy-object": ["M8.5 15.5l3.5-3.5", "M9.8 9.6l.9-.9a3.2 3.2 0 0 1 4.5 4.5l-.9.9", "M10.7 18.4l-.9.9a3.2 3.2 0 0 1-4.5-4.5l.9-.9", "M15 3.5h5.5V9M20.5 3.5l-5 5"],
  unlink: ["M10 14a4.5 4.5 0 0 0 6.4 0l1.2-1.2", "M19.4 11l.1-.1a4.5 4.5 0 0 0-6.4-6.4l-1 1", "M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1", "M4 4l16 16"],
  apply: ["M5 12.5l4.5 4.5L19 7.5"],
  page: ["M7 3.5h7l4 4v13H7z", "M14 3.5v4h4"],
  gone: ["M8.5 8.5l7 7"],
  outside: ["M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"],
  object: [],
} as const;

export function LinkGlyph({ name, size }: { name: keyof typeof paths; size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "gone" && <circle cx="12" cy="12" r="8.5" />}
    {name === "object" && <rect x="4.5" y="4.5" width="15" height="15" rx="2.5" />}
    {paths[name].map(path => <path key={path} d={path} />)}
  </svg>;
}

export function LinkBar({ bar, top }: { bar: LinkBarModel; top: number }) {
  return <div className="link-bar" role="group" aria-label={LINK_WORDS.group} style={{ left: bar.left, top }} onKeyDown={e => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); bar.close(); }
    if (e.key !== "Tab") return;
    const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("input, button:not(:disabled)"));
    const first = controls[0], last = controls.at(-1);
    if (e.shiftKey ? e.target === first : e.target === last) {
      e.preventDefault();
      (e.shiftKey ? last : first)?.focus();
    }
  }}>
    <input type="text" inputMode="url" autoComplete="off" spellCheck={false} aria-label={LINK_WORDS.address}
      placeholder={LINK_WORDS.placeholder} value={bar.value} autoFocus onFocus={e => e.currentTarget.select()}
      aria-invalid={bar.refused || undefined} aria-describedby={bar.refused ? "link-refusal" : undefined}
      onChange={e => bar.change(e.currentTarget.value)} onKeyDown={e => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); bar.submit(); }
      }} />
    <button type="button" className="icon-button" aria-label={LINK_WORDS.remove} onClick={bar.remove} disabled={!bar.canRemove}>
      <LinkGlyph name="unlink" size={18} /><span className="tooltip">{LINK_WORDS.remove}</span>
    </button>
    <button type="button" className="icon-button link-apply" aria-label={LINK_WORDS.apply} onClick={bar.apply} disabled={!bar.canApply}>
      <LinkGlyph name="apply" size={18} /><span className="tooltip">{LINK_WORDS.apply}</span>
    </button>
    {bar.refused && <p id="link-refusal" className="link-refusal">{LINK_WORDS.refused}</p>}
  </div>;
}
