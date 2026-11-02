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
        const outline = box && screenPoint(box, view, size);
        const cursor = other.cursor && (showCursors || followed?.connection === other.connection) ? other.cursor : null;
        return <div className="presence-connection" key={other.connection}>
          {box && outline && <div className="presence-outline" style={{ left: outline.left - 2, top: outline.top - 2,
            width: box.width * view.z, height: box.height * view.z, borderColor: other.colour }} />}
          {cursor && <div className="presence-cursor" style={{ ...screenPoint(cursor, view, size), color: other.colour }}>
            <svg width="18" height="20" viewBox="0 0 18 20">
              <path d="M1.5 1.5 L1.5 16 L5.6 12.4 L8.4 18.4 L11 17.2 L8.3 11.3 L14 11.1 Z"
                fill={other.colour} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span style={{ background: other.colour }}>{pillWords(other)}</span>
          </div>}
        </div>;
      })}
      {followed && <div className="presence-frame" style={{ borderColor: followed.colour }} />}
    </div>
    {followed && <div className="presence-follow-banner" style={{ background: followed.colour }}>
      <span>Following {followed.label}</span><button onClick={hosted.stopFollowing}>Stop following</button>
    </div>}
  </>;
}
