// SPDX-License-Identifier: Apache-2.0
import type { Pages } from '../find';
import { Icon } from '../icons';
import { menuKeys } from './pages-panel';
export function MoveToPage({ pages, selected, reason }: { pages: Pages; selected: ReadonlySet<string>; reason: string }) {
  if (!pages.local || !pages.canEdit || pages.list.length < 2) return null;
  const disabled = pages.voteReason(pages.id) || reason || (!pages.movedCount(selected) ? 'Select an object to move.' : '');
  const anchor = pages.moveButton.current?.getBoundingClientRect();
  return <span className="move-page-control">
    <button ref={pages.moveButton} className={'icon-button move-page-button' + (pages.moveOpen ? ' page-active' : '')} aria-label="Move to page" title={disabled || 'Move to page'} disabled={!!disabled}
      aria-haspopup="menu" aria-expanded={pages.moveOpen} onClick={pages.toggleMove}><Icon name="move-page" /><span className="tooltip">{disabled || 'Move to page'}</span></button>
    {pages.moveOpen && <div ref={pages.moveMenu} role="menu" aria-label="Move to page" className="page-menu move-page-menu" style={{ left: Math.max(12, Math.min(anchor?.left ?? 12, window.innerWidth - 232)), top: (anchor?.bottom ?? 0) + 8 }} onKeyDown={e => menuKeys(e, pages.closeMove)}>
      <div className="page-menu-heading">Move to page</div>
      {pages.list.map(page => <button key={page.id} role="menuitem" disabled={page.id === pages.id || !!disabled} aria-disabled={page.id === pages.id || !!disabled} onClick={() => pages.move(page.id, selected)}>
        <span>{page.name}</span>{page.id === pages.id && <small>This page</small>}
      </button>)}
    </div>}
  </span>;
}
