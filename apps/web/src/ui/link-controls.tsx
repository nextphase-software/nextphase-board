// SPDX-License-Identifier: Apache-2.0
import type { LinkBar } from "../link-cards";

export function LinkControls({ bar, reason }: { bar: LinkBar; reason: string }) {
  const button = (label: string, action: () => void, icon: React.ReactNode, pressed?: boolean) => {
    const blocked = label !== "Open link" && !!reason;
    return <button className="icon-button" aria-label={label} aria-pressed={pressed}
      disabled={blocked} aria-describedby={blocked ? "selection-reason" : undefined} onClick={action}>
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">{icon}</svg>
      <span className="tooltip">{blocked ? reason : label}</span>
    </button>;
  };
  return <>
    <span>{bar.count === 1 ? "Link" : `${bar.count} links`}</span><span className="divider" aria-hidden="true" />
    {bar.count === 1 && <>
      {button("Open link", bar.open, <path strokeLinecap="round" strokeLinejoin="round" d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />)}
      {bar.look !== "loading" && <span className="link-layout" role="group" aria-label="Link layout">
        {button("Display vertical", () => bar.setLayout("vertical"), <><rect x={6} y={3} width={12} height={18} rx={2} />
          <path d="M6 11h12" /><path d="M9 15h6M9 18h4" strokeLinecap="round" /></>, bar.layout === "vertical")}
        {button("Display horizontal", () => bar.setLayout("horizontal"), <><rect x={2.5} y={7} width={19} height={10} rx={2} />
          <path d="M9 7v10" /><path d="M12 10.5h6M12 13.5h4" strokeLinecap="round" /></>, bar.layout === "horizontal")}
      </span>}
      {button("Change back to text", bar.toText, <path strokeLinecap="round" strokeLinejoin="round"
        d="M4 7V5h11v2M9.5 5v13M7.5 18h4M15 14h5M18 11.5l2.5 2.5-2.5 2.5" />)}
    </>}
  </>;
}
