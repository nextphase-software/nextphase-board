// SPDX-License-Identifier: Apache-2.0
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { screenPoint, type View } from '../view';
import type { HostedBoard, ReactionId } from './hosted-board';
import { burstCopies, REACTIONS, reactionKeyAllowed, slotPosition, wheelPlacement } from './reactions-rules';

const outline = { paintOrder: 'stroke', stroke: '#fff', strokeWidth: 2.2, strokeLinejoin: 'round' } as const;
const hand = 'M8.2 10.4 11.6 3.6c.3-.6 1-.9 1.6-.6 1.1.5 1.6 1.7 1.3 2.9l-.7 2.9h4.6c1.2 0 2.1 1.1 1.9 2.3l-1.2 7.1c-.2 1.1-1.1 1.8-2.2 1.8H8.2Z';
function Artwork({ id, label = '', colour = '#2563eb' }: { id: ReactionId; label?: string; colour?: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    {(id === 'thumbs-up' || id === 'thumbs-down') && <g transform={id === 'thumbs-down' ? 'rotate(180 12 12)' : undefined}>
      <path {...outline} fill={id === 'thumbs-up' ? '#f5b829' : '#5b8def'} d={hand}/>
      <rect {...outline} x="3.2" y="10" width="4" height="10.4" rx="1.2" fill={id === 'thumbs-up' ? '#e0a312' : '#3f73d6'}/>
    </g>}
    {id === 'plus-one' && <text {...outline} x="12" y="17.4" textAnchor="middle" fontSize="15" fontWeight="800" fill="#7051cf">+1</text>}
    {id === 'star' && <path {...outline} fill="#f5b829" d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17.1 6.4 20l1.1-6.2-4.6-4.4 6.3-.9Z"/>}
    {id === 'question' && <text {...outline} x="12" y="19" textAnchor="middle" fontSize="19" fontWeight="800" fill="#e8533c">?</text>}
    {id === 'dot' && <><circle {...outline} cx="12" cy="12" r="8" fill="#e8533c"/><circle cx="9.4" cy="9.2" r="2.2" fill="#fff" opacity=".35"/></>}
    {id === 'me' && <><circle {...outline} cx="12" cy="12" r="9" fill={colour}/><text x="12" y="16.2" textAnchor="middle" fontSize="11.5" fontWeight="700" fill="#fff">{[...label][0]?.toUpperCase()}</text></>}
    {id === 'heart' && <path {...outline} fill="#f0707c" d="M12 20.4s-7.8-4.6-7.8-10.2c0-2.6 2-4.6 4.4-4.6 1.5 0 2.7.7 3.4 1.9.7-1.2 1.9-1.9 3.4-1.9 2.4 0 4.4 2 4.4 4.6 0 5.6-7.8 10.2-7.8 10.2Z"/>}
  </svg>;
}
export function ReactionTool({ hosted, tool, setTool, scene }: {
  hosted: HostedBoard; tool: string; setTool: Dispatch<SetStateAction<string>>; scene: RefObject<HTMLDivElement | null>;
}) {
  const r = hosted.reactions;
  useSyncExternalStore(r.subscribe, r.getSnapshot);
  const button = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null), composing = useRef(false);
  useLayoutEffect(() => r.bindTool(setTool), [r, setTool]);
  useLayoutEffect(() => { r.toolChanged(tool); }, [r, tool]);
  const close = () => { r.closeWheel(); if (opener.current?.isConnected) opener.current.focus(); };
  const pick = (id: ReactionId) => { r.arm(id); scene.current?.focus(); };
  const open = (pointer = false) => {
    const b = button.current; if (!b || r.disabledReason) return;
    if (!pointer) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    opener.current = pointer ? scene.current : b;
    r.open(wheelPlacement(innerWidth, innerHeight, b.getBoundingClientRect(), b.closest('.palette')!.getBoundingClientRect().top, pointer ? r.pointer : undefined));
  };
  useLayoutEffect(() => {
    if (r.wheel) menu.current?.querySelectorAll<HTMLButtonElement>('[role=menuitemradio]')[Math.max(0, REACTIONS.findIndex(([id]) => id === r.armed))]?.focus();
  }, [!!r.wheel]);
  useLayoutEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest(".export-dialog")) return;
      if (e.target instanceof Element && e.target.closest('.find-bar')) return;
      if (e.isComposing || composing.current) return;
      if (e.key === 'Escape' && (r.wheel || r.armed)) {
        e.preventDefault(); e.stopImmediatePropagation(); r.wheel ? close() : (r.disarm(), scene.current?.focus()); return;
      }
      if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey && !e.altKey &&
        (r.wheel && menu.current?.contains(e.target as Node) || reactionKeyAllowed(e.target as Element, scene.current, document.body, false)) && !r.disabledReason) {
        e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) r.wheel ? close() : open(true);
      }
    };
    const outside = (e: PointerEvent) => { if (r.wheel && e.target instanceof Element && !e.target.closest('.reactions-wheel,.reactions-tool')) close(); };
    const start = () => { composing.current = true; }, end = () => { composing.current = false; };
    // Window capture runs before manual-follow and spotlight document handlers.
    window.addEventListener('keydown', key, true); document.addEventListener('pointerdown', outside, true);
    window.addEventListener('compositionstart', start, true); window.addEventListener('compositionend', end, true);
    return () => { window.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', outside, true); window.removeEventListener('compositionstart', start, true); window.removeEventListener('compositionend', end, true); };
  }, [hosted]);
  function menuKey(e: React.KeyboardEvent) {
    if (e.isDefaultPrevented() || e.nativeEvent.isComposing) return;
    const buttons = [...menu.current!.querySelectorAll<HTMLButtonElement>('button')], index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | undefined;
    if (/^[1-8]$/.test(e.key)) { e.preventDefault(); e.stopPropagation(); pick(REACTIONS[Number(e.key) - 1][0]); return; }
    if (e.key === 'Tab') next = (index + (e.shiftKey ? 8 : 1)) % 9;
    else if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) next = ((index % 8) + (['ArrowLeft', 'ArrowUp'].includes(e.key) ? 7 : 1)) % 8;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 7;
    if (next !== undefined) { e.preventDefault(); e.stopPropagation(); buttons[next].focus(); }
  }
  const reason = r.disabledReason, armedName = REACTIONS.find(([id]) => id === r.armed)?.[1], self = hosted.presence.self;
  return <>
    <button ref={button} className="icon-button reactions-tool" type="button" aria-label={armedName ? `Reactions, ${armedName} armed` : 'Reactions'}
      aria-haspopup="menu" aria-expanded={!!r.wheel} aria-pressed={!!r.armed} disabled={!!reason} aria-describedby={reason ? 'reactions-disabled' : undefined}
      onClick={() => { if (r.wheel) close(); else if (r.armed) { r.disarm(); scene.current?.focus(); } else open(); }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true">
        <circle cx="10" cy="10" r="7.2" strokeWidth="1.6"/><circle cx="7.4" cy="8.4" r="1" fill="currentColor" stroke="none"/><circle cx="12.6" cy="8.4" r="1" fill="currentColor" stroke="none"/>
        <path d="M6.8 11.6c.7 1.4 1.9 2.1 3.2 2.1s2.5-.7 3.2-2.1" strokeWidth="1.6" strokeLinecap="round"/>
      </svg><span className="tooltip" id={reason ? 'reactions-disabled' : undefined}>{reason || 'Reactions · E'}</span>
    </button>
    {r.wheel && createPortal(<div ref={menu} className="reactions-wheel" style={r.wheel} role="menu" aria-label="Reactions" onKeyDown={menuKey}>
      {REACTIONS.map(([id, name], index) => <button key={id} className="reactions-slot" type="button" role="menuitemradio" aria-checked={r.armed === id} aria-label={name}
        style={slotPosition(index)} onClick={() => pick(id)}>
        <Artwork id={id} label={self?.label} colour={self?.colour}/><span className="reactions-label">{name} · {index + 1}</span>
      </button>)}
      <button className="reactions-centre" type="button" aria-label="Close reactions" onClick={close}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="#302d36"><path d="m5 5 10 10M15 5 5 15" strokeWidth="1.8" strokeLinecap="round"/></svg>
      </button>
    </div>, document.body)}
  </>;
}
export function ReactionsLayer({ hosted, scene, view, size, page }: { hosted: HostedBoard; page: string; scene: RefObject<HTMLDivElement | null>; view: View; size: { w: number; h: number } }) {
  const r = hosted.reactions;
  useSyncExternalStore(r.subscribe, r.getSnapshot);
  const [now, setNow] = useState(Date.now), [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'), change = () => setReduced(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  const live = r.bursts.length > 0;
  useEffect(() => {
    if (!live) return;
    let frame: number;
    const tick = () => { const at = Date.now(); r.expire(at, reduced); setNow(at); if (r.bursts.length) frame = requestAnimationFrame(tick); };
    tick(); return () => cancelAnimationFrame(frame);
  }, [r, live, reduced]);
  useEffect(() => {
    const canvas = scene.current; if (!canvas) return;
    const move = (e: PointerEvent) => { if (e.target instanceof Element && (e.target === canvas || e.target instanceof HTMLCanvasElement)) r.track({ x: e.clientX, y: e.clientY }); else r.track(); };
    const leave = () => r.track();
    const down = (e: PointerEvent) => {
      if (!r.armed || r.disabledReason || e.button !== 0 || r.spaceHeld || !(e.target === canvas || e.target instanceof HTMLCanvasElement)) return;
      e.preventDefault(); e.stopImmediatePropagation(); canvas.focus();
      const rect = canvas.getBoundingClientRect(); r.send(view.x + (e.clientX - rect.left - size.w / 2) / view.z, view.y + (e.clientY - rect.top - size.h / 2) / view.z);
    };
    const double = (e: MouseEvent) => { if (r.armed && !r.spaceHeld) { e.preventDefault(); e.stopImmediatePropagation(); } };
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest(".export-dialog")) return;
      if (e.isComposing || e.target !== canvas) return;
      if (e.code === 'Space') r.spaceHeld = true;
      if (r.armed && e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) r.send(view.x, view.y); }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') r.spaceHeld = false; };
    const blur = () => { r.spaceHeld = false; r.track(); };
    canvas.addEventListener('dblclick', double, true); canvas.addEventListener('pointerdown', down, true); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerleave', leave);
    window.addEventListener('keydown', key, true); window.addEventListener('keyup', up, true); window.addEventListener('blur', blur);
    return () => { canvas.removeEventListener('dblclick', double, true); canvas.removeEventListener('pointerdown', down, true); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerleave', leave); window.removeEventListener('keydown', key, true); window.removeEventListener('keyup', up, true); window.removeEventListener('blur', blur); };
  }, [hosted, view, size.w, size.h]);
  const rect = scene.current?.getBoundingClientRect(), self = hosted.presence.self;
  return <>
    {r.bursts.filter(b => b.page === page && (!b.connection || b.connection === hosted.presence.self?.connection || hosted.presence.others.some(p => p.connection === b.connection && p.page === page))).flatMap(b => {
      const origin = screenPoint(b, view, size);
      if (origin.left < 0 || origin.left > size.w || origin.top < 0 || origin.top > size.h) return [];
      return <div key={b.id} className="reaction-burst" aria-hidden="true">{burstCopies({ x: origin.left, y: origin.top }, Math.max(now, b.started) - b.started, reduced).map((copy, i) =>
        <div className="reaction-copy" key={i} style={{ left: copy.left, top: copy.top, width: copy.size, height: copy.size, opacity: copy.opacity }}><Artwork id={b.reaction} label={b.label} colour={b.colour}/></div>)}</div>;
    })}
    {r.armed && r.pointer && rect && <div className="reaction-pointer" aria-hidden="true" style={{ left: r.pointer.x - rect.left + 12, top: r.pointer.y - rect.top + 12 }}><Artwork id={r.armed} label={self?.label} colour={self?.colour}/></div>}
  </>;
}
