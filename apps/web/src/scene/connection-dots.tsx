// SPDX-License-Identifier: Apache-2.0
import type { ResolvedItem } from "../geometry";
import { connectionDots, type ConnectionDot, type ConnectionDrag } from "../connection-drag";

import { eligibleIdea } from "nextphase-board-rules/objects/registry.ts";

export function ConnectionDots({ dots, connection, objects, pos, zoom }: {
  dots: readonly ConnectionDot[]; connection: ConnectionDrag | undefined; objects: readonly ResolvedItem[];
  pos: (point: { x: number; y: number }) => { left: number; top: number }; zoom: number;
}) {
  const start = connection && pos(connection.start), pointer = connection && pos(connection.pointer);
  const target = connection && objects.find((o) => o.id === connection.target);
  const reconnecting = connection?.reconnect;
  const eligible = reconnecting ? objects.filter((o) => eligibleIdea(o) && o.id !== connection.source) : [];
  const shownDots = reconnecting && target ? connectionDots(objects, new Set([target.id]), zoom) : dots;
  return <>
    {shownDots.map((dot) => <div key={dot.id + dot.side} className={"connection-dot" + (reconnecting && dot.side === connection.side ? " drop-side" : "")} aria-hidden="true"
      data-object-id={dot.id} data-side={dot.side} style={pos(dot.point)} />)}
    {!reconnecting && start && pointer && <svg className="connection-preview" aria-hidden="true">
      <line x1={start.left} y1={start.top} x2={pointer.left} y2={pointer.top}
        strokeWidth={3.5 * zoom} strokeDasharray={`${10 * zoom} ${7 * zoom}`} />
      <circle cx={start.left} cy={start.top} r={9 * zoom} strokeWidth={3.5 * zoom} />
    </svg>}
    {eligible.map((o) => <div key={o.id} className="reconnect-outline" aria-hidden="true" style={{ ...pos(o), width: o.width * zoom, height: o.displayHeight * zoom }} />)}
    {!reconnecting && target && <div className="connection-target" aria-hidden="true" style={{ ...pos(target),
      width: target.width * zoom, height: target.displayHeight * zoom }} />}
  </>;
}
