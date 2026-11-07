// SPDX-License-Identifier: Apache-2.0
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { HostedBoard } from './hosted-board';
import type { BoardHistory } from './history';
import { confirmationAuthor, historyTime, metadataValid, versionHeading, versionSubtitle, type Version } from './history-rules';
import { CommentIcon } from './comments/icons';
export function HistoryDenied({ back }: { back: () => void }) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, []);
  return <div className="history-ending"><main className="history-denied"><h1 ref={title} tabIndex={-1}>This board is not available.</h1><p>You may not have access, or it may no longer be available.</p><button onClick={back}>Back to files</button></main></div>;
}
function HistoryModal({ h, title, focus, children }: { h: BoardHistory; title: string; focus?: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const node = dialog.current!; node.showModal();
    (node.querySelector<HTMLElement>(focus ?? 'input,button:not([disabled])') ?? node).focus();
    return () => node.close();
  }, []);
  return <dialog ref={dialog} className="team-dialog history-dialog" aria-label={title} tabIndex={-1}
    onCancel={e => { e.preventDefault(); h.cancel(); }} onKeyDown={e => {
      e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); h.cancel(); }
      if (e.key === 'Tab') {
        const controls = [...e.currentTarget.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"],a[href]',
        )].filter(node => node.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (!first) { e.preventDefault(); e.currentTarget.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last!.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }}><h1>{title}</h1>{children}</dialog>;
}
function HistoryQuestion({ h }: { h: BoardHistory }) {
  const kind = h.dialog, version = h.dialog === "name" ? h.naming ?? h.selected : h.selected;
  if (!kind) return null;
  const cancel = <button onClick={() => h.cancel()} disabled={h.writing}>Cancel</button>;
  const retry = <button className="primary" onClick={() => void h.restore()}>Retry</button>;
  let title = '', content: ReactNode, focus: string | undefined;
  if (kind === 'save' || kind === 'name') {
    const name = kind === 'name'; title = name ? 'Name version' : 'Save version';
    content = <>
      <p>{name && version ? `${historyTime(version.capturedAt)}. Naming this version does not renew its age.` : 'Save the latest server-confirmed board. Unposted comments and unsaved tab edits are not included.'}</p>
      <label htmlFor="history-name">Name (optional)</label><input id="history-name" className="history-field" value={h.name} readOnly={h.writing || h.writeFailed} onChange={e => h.fields(e.target.value, h.description)} />
      <small className="history-count">{[...h.name].length} / 100</small>
      <label htmlFor="history-description">Description (optional)</label><textarea id="history-description" className="history-field" value={h.description} readOnly={h.writing || h.writeFailed} onChange={e => h.fields(h.name, e.target.value)} />
      <small className="history-count">{[...h.description].length} / 500</small>
      {h.writeFailed && <p className="comment-note error" role="alert">{name ? 'Couldn’t save name. Your text is kept. Try again.' : 'Couldn’t save version. Your text is kept. Try again.'}</p>}
      <div className="history-dialog-actions">{cancel}<button className="primary" disabled={h.writing || !metadataValid(h.name,100) || !metadataValid(h.description,500)} onClick={() => void h.write()}>{h.writeFailed ? 'Retry' : name ? 'Save name' : 'Save version'}</button></div>
    </>;
  } else if (kind === 'confirm' && version) {
    title = 'Restore this version?';
    const author = confirmationAuthor(version);
    content = <>
      <p><strong>{versionHeading(version)}{h.reviewedAt ? ` · ${historyTime(version.capturedAt)}` : ''}</strong>{!h.reviewedAt && <><br />{historyTime(version.capturedAt)}{author !== null ? ` · ${author}` : ''}</>}</p>
      {h.reviewedAt ? <p className="comment-note amber">The current board changed. You reviewed it at {historyTime(h.reviewedAt)}. Restore now keeps that latest state as “Before restore”.</p> : <p>The current board will be kept as “Before restore”. This version becomes a new current version on the same board.</p>}
      <p>{h.reviewedAt ? 'Current comments are kept. Everyone will rejoin with board Undo/Redo cleared.' : 'Current comments and mention read status are kept. Everyone will rejoin; board Undo and Redo will be cleared.'}</p>
      <div className="history-dialog-actions">{cancel}<button className="primary" onClick={() => void h.restore()}>Restore this version</button></div>
    </>;
  } else if (kind === 'stale') {
    title = 'The board changed'; focus = '.primary';
    content = <><p>Someone edited the current board after you opened the confirmation. Nothing was restored.</p><p>Review the latest current version before confirming again.</p><div className="history-dialog-actions">{cancel}<button className="primary" onClick={() => h.review()}>Review current version</button></div></>;
  } else if (kind === 'restoring') {
    title = 'Restoring version…';
    content = <><p>Edits and comments are paused while Board keeps the current state and restores the selected version.</p><p>Wait for confirmation before editing.</p><div className="history-dialog-actions"><button disabled>Restoring…</button></div></>;
  } else if (kind === 'pending') {
    title = 'Restore not confirmed';
    content = <><p className="comment-note amber">Board has not confirmed whether the restore completed. Editing stays paused.</p><p>Retry checks the same restore request. It will not restore twice.</p><div className="history-dialog-actions">{retry}</div></>;
  } else if (kind === 'failed') {
    title = 'Couldn’t restore version';
    content = <><p className="comment-note error">The restore failed. The current board and its history were not changed.</p><p>Try again when Board’s server is available.</p><div className="history-dialog-actions">{cancel}{retry}</div></>;
  } else {
    title = 'Action not available';
    content = <><p>You need edit access to save, name or restore versions. Nothing was changed.</p><div className="history-dialog-actions"><button onClick={() => h.cancel()}>Back to history</button></div></>;
  }
  return <HistoryModal key={kind} h={h} title={title} focus={focus}>{content}</HistoryModal>;
}
export function HistoryPanel({ hosted }: { hosted: HostedBoard }) {
  const h = hosted.history, title = useRef<HTMLHeadingElement>(null), previewTitle = useRef<HTMLElement>(null);
  const [menu, setMenu] = useState<{ version: Version; opener: HTMLElement; left: number; top: number } | null>(null);
  const menuNode = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (h.open) title.current?.focus(); }, [h.open]);
  useLayoutEffect(() => {
    if (!h.previewing) return;
    document.querySelector<HTMLElement>(`[data-version="${h.selectedId}"]`)?.scrollIntoView({ block:'nearest' });
    previewTitle.current?.focus();
  }, [h.selectedId, h.state, h.previewing]);
  useLayoutEffect(() => { menuNode.current?.querySelector<HTMLElement>('button')?.focus(); }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const outside = (e: PointerEvent) => { if (!menuNode.current?.contains(e.target as Node)) setMenu(null); };
    window.addEventListener('pointerdown',outside); return () => window.removeEventListener('pointerdown',outside);
  }, [menu]);
  const previewState = h.state.startsWith('preview-') || h.state === 'expired';
  const status = h.state === 'loading' ? 'Loading version history…' : h.state === 'preview-loading' ? 'Loading version…' : h.state === 'failed' ? 'Couldn’t load version history' : h.state === 'preview-failed' ? 'Couldn’t load this version' : h.state === 'expired' ? 'This version is no longer available.' : '';
  const message = h.state === 'failed' ? 'Try again when Board’s server is available.' : h.state === 'preview-failed' ? 'The preview is unavailable. Try again.' : h.state === 'expired' ? 'Choose another version or return to current.' : '';
  return <>
    {h.previewing ? <div className="history-banner" onKeyDown={e => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); h.close(); } }}><div className="history-summary">
      <strong ref={previewTitle} tabIndex={-1}>{previewState || !h.selected ? status : `${versionHeading(h.selected)} · Read-only preview`}</strong>
      {!previewState && h.selected && h.document && <small>{historyTime(h.selected.capturedAt)} · Board: {h.document.title}</small>}
    </div><button onClick={() => h.current()} disabled={h.locked}>Back to current version</button></div>
    : h.restored ? <div className="history-banner" role="status"><div className="history-summary"><strong>Version restored</strong><small>{h.restored} is current. The replaced board is kept as Before restore.</small></div></div>
    : h.kept ? <div className="history-banner amber wide" role="status"><div className="history-summary"><strong>{h.actor === null ? '' : h.actor + ' restored this board · '}{h.rejoining ? 'Rejoining…' : 'Rejoined'}</strong><small>{h.rejoining ? 'Edits and comments are paused. Previous edits will not be resent. Unposted text is kept for review.' : 'Board Undo/Redo cleared. Earlier unsaved edits were not applied. Your unposted comment is kept; review it before posting.'}</small></div></div> : null}
    {h.open && <section className="history-shell" aria-label="Version history" onKeyDown={e => {
      e.stopPropagation(); if(e.key === 'Escape' && !menu) {e.preventDefault();h.close();}
    }}>
      <header className="history-header"><h2 ref={title} tabIndex={-1}>Version history</h2><button className="comment-icon" aria-label="Close version history" disabled={h.locked} onClick={() => h.close()}><CommentIcon name="close" /></button></header>
      <div className="history-limit">Newest 50 versions · Up to 30 days<br />Named versions expire too.</div>
      {h.canManage && h.state === 'ready' && h.versions.length > 0 && <div className="history-actions"><button onClick={e => h.begin('save',e.currentTarget)}>Save version…</button></div>}
      {h.state !== 'ready' ? <div className={'history-state' + (h.state.includes('failed') ? ' error' : '')} role="status"><strong>{status}</strong>{message && <p>{message}</p>}{h.state.includes('failed') && <button onClick={() => void (h.state === 'failed' ? h.refresh() : h.selected && h.select(h.selected))}>Retry</button>}</div>
      : !h.versions.length ? <div className="history-state"><strong>No versions yet</strong><p>Versions will appear after the first confirmed save.</p></div>
      : <div className="history-list">{h.versions.map(v => <div key={v.id} data-version={v.id} className={'history-row' + (v.id === h.selectedId && h.previewing ? ' current' : '')}>
        <button className="history-open" aria-label={versionHeading(v)} onClick={() => void h.select(v)}><strong>{versionHeading(v)}</strong><small>{historyTime(v.capturedAt)}</small><small>{versionSubtitle(v)}</small></button>
        {h.canManage && <button className="comment-icon" aria-label={`More options for ${versionHeading(v)}`} onClick={e => {
          const rect = e.currentTarget.getBoundingClientRect();setMenu({version:v,opener:e.currentTarget,left:Math.max(12,rect.right-208),top:rect.bottom+6});
        }}><CommentIcon name="more" /></button>}
      </div>)}</div>}
      <footer className="history-footer">{h.canManage && h.previewing && h.selected && h.state === 'ready' && <button className="primary" onClick={e => void h.confirm(e.currentTarget)}>Restore this version</button>}
        <p>{!h.canManage ? 'You can browse history. Saving, naming and restoring require edit access.' : h.restored ? 'Current comments are kept. Close history to open Comments.' : 'Current comments appear after you return to the current version.'}</p></footer>
    </section>}
    {menu && <div ref={menuNode} className="home-menu history-version-menu" role="menu" style={{left:menu.left,top:menu.top}} onKeyDown={e => {
      e.stopPropagation();if(e.key === 'Escape') {e.preventDefault();menu.opener.focus();setMenu(null);}
    }}><button role="menuitem" onClick={() => {h.begin('name',menu.opener,menu.version);setMenu(null);}}>Name version…</button></div>}
    {h.dialog && <HistoryQuestion h={h} />}
  </>;
}
