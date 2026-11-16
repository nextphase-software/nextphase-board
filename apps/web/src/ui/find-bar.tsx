// SPDX-License-Identifier: Apache-2.0
import { Icon } from '../icons';
import type { FindActions } from '../find';

export function FindBar({ find }: { find: FindActions }) {
  return <section className="find-bar floating" aria-label="Find on board" onKeyDown={event => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); find.close(); }
    else if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      event.preventDefault(); event.stopPropagation(); find.step(event.shiftKey ? -1 : 1);
    }
  }}>
    <div className="find-row">
      <span className="find-search"><Icon name="search" /></span>
      <input ref={find.field} type="text" aria-label="Find on board" placeholder="Find…" maxLength={200}
        value={find.query} onChange={event => find.changeQuery(event.currentTarget.value)} />
      <div className="find-live" aria-live="polite" aria-atomic="true">
        <span className="find-counter">{find.counter}</span>
        {(find.removed || find.pageLine) && <div className="find-removed">{find.removed || find.pageLine}</div>}
      </div>
      <button className="icon-button" aria-label="Previous result" title="Previous result · ⇧Return"
        disabled={!find.results.length} onClick={() => find.step(-1)}><Icon name="chevron-up" /><span className="tooltip">Previous result · ⇧Return</span></button>
      <button className="icon-button" aria-label="Next result" title="Next result · Return"
        disabled={!find.results.length} onClick={() => find.step(1)}><Icon name="chevron-up" /><span className="tooltip">Next result · Return</span></button>
      <span className="find-divider" aria-hidden="true" />
      <button className="icon-button" aria-label="Close find" title="Close find · Esc" onClick={find.close}>
        <Icon name="close" /><span className="tooltip">Close find · Esc</span></button>
    </div>
  </section>;
}
