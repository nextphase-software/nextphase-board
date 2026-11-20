// SPDX-License-Identifier: Apache-2.0
import type { KeyboardEvent } from 'react';
import type { Pages } from '../find';
import { ONLY_PAGE } from '../pages';
import { Icon } from '../icons';
import { COPY_PAGE_LINK } from '../page-links.ts';

export function menuKeys(event: KeyboardEvent<HTMLElement>, close: () => void) {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', ' ', 'Escape'].includes(event.key)) return;
  event.stopPropagation();
  if (event.key === 'Escape') { event.preventDefault(); close(); return; }
  const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
  const at = items.indexOf(document.activeElement as HTMLButtonElement);
  if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : (at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[index]?.focus();
  }
}
export function PagesPanel({ pages }: { pages: Pages }) {
  if (!pages.open) return null;
  const menuPage = pages.list.find(p => p.id === pages.menu), at = pages.list.findIndex(p => p.id === pages.menu);
  const anchor = pages.options.current.get(pages.menu)?.getBoundingClientRect();
  const rowKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target instanceof HTMLInputElement || (event.target as HTMLElement).closest('[role="menu"]')) return;
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End', 'Enter', ' ', 'Escape'].includes(event.key)) return;
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); if (pages.drag) pages.endDrag(true); else pages.closeList(); return; }
    if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const buttons = pages.list.map(p => pages.names.current.get(p.id)).filter(b => !!b);
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : Math.max(0, Math.min(buttons.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)));
      buttons[index]?.focus();
    }
  };
  const gaps = pages.list.filter(p => p.id !== pages.drag?.id);
  const lineBefore = (id: string) => pages.drag?.active && gaps[pages.drag.gap]?.id === id;
  return <>
    <section ref={pages.panel} className="pages-panel" aria-label="Pages" style={{ left: pages.button.current?.getBoundingClientRect().left ?? 12 }} onKeyDown={rowKeys}>
      <header><h2>Pages</h2>{pages.canEdit ? <button className="page-icon" aria-label="Add page" title={pages.addReason || 'Add page'} disabled={!!pages.addReason} onClick={pages.add}><Icon name="page-plus" /></button> : <span className="pages-people-view-only">View only</span>}</header>
      <ul>{pages.list.map(page => <li key={page.id} data-page={page.id} className={'page-row' + (page.id === pages.id ? ' current' : '') + (page.id === pages.menu ? ' menu-open' : '') + (pages.drag?.id === page.id && pages.drag.active ? ' dragging' : '') + (lineBefore(page.id) ? ' drop-before' : '')}>
        {pages.editing === page.id ? <input ref={pages.nameField} aria-label="Page name" value={pages.name} onChange={e => pages.changeName(e.currentTarget.value)}
          onKeyDown={e => {
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','Enter',' ','Escape'].includes(e.key)) e.stopPropagation();
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); pages.finishName(e.key === 'Enter'); }
          }} /> : <>
          <button className="page-name" ref={element => { if (element) pages.names.current.set(page.id, element); else pages.names.current.delete(page.id); }}
            aria-current={page.id === pages.id ? 'page' : undefined} disabled={!!pages.openingReason} title={pages.openingReason || page.name}
            onClick={e => { if (!e.detail) pages.openPage(page.id); else pages.clickPage(page.id); }} onDoubleClick={() => { if (pages.canEdit) pages.rename(page.id); }}
            onPointerDown={e => { if (pages.canEdit && e.button === 0) { pages.beginDrag(page.id, e.clientY); e.currentTarget.setPointerCapture(e.pointerId); } }}
            onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) pages.dragTo(e.clientY); }}
            onPointerUp={e => { if (pages.endDrag()) pages.suppressClick(); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
            onPointerCancel={() => pages.endDrag(true)} onLostPointerCapture={() => pages.endDrag(true)}>{page.name}</button>
          {pages.people(page.id).name && <span className="pages-people" role="img" aria-label={pages.people(page.id).name}>
            {pages.people(page.id).shown.map(p => <span key={p.person} title={p.label} style={{ background: p.colour }}>{[...p.label][0]?.toUpperCase()}</span>)}
            {pages.people(page.id).overflow > 0 && <span className="pages-people-overflow">+{pages.people(page.id).overflow}</span>}
          </span>}
          <button className="page-icon page-options" ref={element => { if (element) pages.options.current.set(page.id, element); else pages.options.current.delete(page.id); }}
            aria-label={`Page options for ${page.name}`} title="Page options" aria-expanded={pages.menu === page.id} aria-haspopup="menu" onClick={() => pages.showMenu(page.id)}><Icon name="page-more" /></button>
        </>}
      </li>)}{pages.drag?.active && pages.drag.gap === gaps.length && <li className="page-drop-end" aria-hidden="true" />}</ul>
    </section>
    {menuPage && <div ref={pages.pageMenu} role="menu" aria-label="Page options" className="page-menu" style={{ left: Math.max(12, Math.min(anchor?.left ?? 12, window.innerWidth - 232)), top: (anchor?.bottom ?? 68) + 4 }} onKeyDown={e => menuKeys(e, pages.closeMenu)}>
      <button role="menuitem" onClick={() => pages.choose(COPY_PAGE_LINK, menuPage.id)}><span>{COPY_PAGE_LINK}</span></button>
      {pages.canEdit && ['separator-copy','Rename page','Duplicate page','separator-1','Move up','Move down','separator-2','Delete page'].map(action => {
        if (action.startsWith('separator')) return <div key={action} role="separator" />;
        const reason = pages.editingReason || (action === 'Duplicate page' ? pages.duplicateReason(menuPage.id)
          : action === 'Delete page' && (pages.voteReason(menuPage.id) || pages.list.length === 1) ? pages.voteReason(menuPage.id) || ONLY_PAGE : action === 'Move up' && at === 0 || action === 'Move down' && at === pages.list.length - 1 ? 'This page is already ' + (at === 0 ? 'first.' : 'last.') : '');
        return <button key={action} role="menuitem" disabled={!!reason} aria-disabled={!!reason} title={reason || undefined} className={action === 'Delete page' ? 'page-danger' : ''} onClick={() => pages.choose(action, menuPage.id)}><span>{action}</span></button>;
      })}
    </div>}
  </>;
}
