// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, RefObject, SetStateAction } from "react";
import { hasRectangle } from "nextphase-board-rules/objects/registry.ts";
import type { ResolvedItem } from "../geometry";
import { boundingBox } from "../selection";
import { usePresence } from "../state/use-presence";
import { screenPoint, type View } from "../view";
import type { HostedBoard } from "./hosted-board";
import { pillWords } from "./presence";

type Props = {
  hosted: HostedBoard;
  scene: RefObject<HTMLDivElement | null>;
  selected: Set<string>;
  objects: ResolvedItem[];
  view: View;
  size: { w: number; h: number };
  setFollowView: Dispatch<SetStateAction<View>>;
};

export function PresenceLayer(props: Props) {
  const { hosted, objects, view, size } = props;
  const { self, others, followed, showCursors } = usePresence(props);
  return <>
    <div className="presence-layer" aria-hidden="true">
      {others.filter((other) => other.connection !== self?.connection).map((other) => {
        const selected = objects.filter((object) => other.selection.includes(object.id));
        const rectangles = selected.filter(hasRectangle);
        const box = boundingBox(rectangles.length ? rectangles : selected);
        const cursor = other.cursor && (showCursors || followed?.connection === other.connection) ? other.cursor : null;
        return <div className="presence-connection" key={other.connection}>
          {box && <div className="presence-outline" style={{ ...screenPoint(box, view, size),
            width: box.width * view.z, height: box.height * view.z, borderColor: other.colour }} />}
          {cursor && <div className="presence-cursor" style={{ ...screenPoint(cursor, view, size), color: other.colour }}>
            <svg width="20" height="24" viewBox="0 0 20 24"><path d="M1 1 L18 15 L10 16 L6 23 Z" fill="currentColor" stroke="white" strokeWidth="1.5" /></svg>
            <span style={{ background: other.colour }}>{pillWords(other)}</span>
          </div>}
        </div>;
      })}
      {followed && <div className="presence-frame" style={{ borderColor: followed.colour }} />}
    </div>
    {followed && <div className="presence-follow-banner" style={{ background: followed.colour }}>
      <span>Following {followed.label} ·</span><button onClick={hosted.stopFollowing}>Stop following</button>
    </div>}
  </>;
}
