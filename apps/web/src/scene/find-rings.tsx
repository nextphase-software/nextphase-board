// SPDX-License-Identifier: Apache-2.0
import type { FindActions } from '../find';

export function FindRings({ find, page, pos, zoom }: {
  find: FindActions; page: string; pos: (point: { x: number; y: number }) => { left: number; top: number }; zoom: number;
}) {
  if (!find.open) return null;
  return <>{find.results.filter(result => result.page === page).map(result => {
    const current = result.id === find.cursor.current?.id, outside = current ? 5 : 4, point = pos(result);
    return <div key={result.id} className={'find-ring' + (current ? ' current' : '')} aria-hidden="true"
      style={{ left: point.left - outside, top: point.top - outside,
        width: result.width * zoom + outside * 2, height: result.height * zoom + outside * 2 }} />;
  })}</>;
}
