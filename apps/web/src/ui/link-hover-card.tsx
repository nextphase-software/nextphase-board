// SPDX-License-Identifier: Apache-2.0
import { LINK_WORDS, type LinkCardModel } from "../text-links";
import { Icon } from "../icons";
import { DrawingIcon } from "./drawing-tools";
import { LinkGlyph } from "./link-bar";

export function LinkHoverCard({ card }: { card: LinkCardModel | null }) {
  if (!card) return null;
  const { label } = card;
  const icon = label.icon !== "object" || !label.tool ? <LinkGlyph name={label.icon} size={16} />
    : label.tool === "Draw" ? <DrawingIcon name="Marker" />
    : label.tool === "Image" ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 3-5 6 7" />
    </svg> : <Icon name={label.tool as Parameters<typeof Icon>[0]["name"]} />;
  return <div className="link-card" role="group" aria-label={LINK_WORDS.details} style={{ left: card.left, top: card.top }}
    ref={card.measure} onPointerEnter={card.enter} onPointerLeave={card.leave}>
    <span className="link-icon">{icon}</span>
    <span className={label.muted ? "link-label muted" : "link-label"}>{label.text}</span>
    <span className="divider" aria-hidden="true" />
    <button type="button" className="icon-button" aria-label={LINK_WORDS.copy} onClick={card.copy}>
      <Icon name="Duplicate" /><span className="tooltip">{LINK_WORDS.copy}</span>
    </button>
    {card.editable && <button type="button" className="icon-button" aria-label={LINK_WORDS.edit} onClick={card.edit}>
      <Icon name="pencil" /><span className="tooltip">{LINK_WORDS.edit}</span>
    </button>}
  </div>;
}
