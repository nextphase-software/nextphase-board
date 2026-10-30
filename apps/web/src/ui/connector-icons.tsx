// SPDX-License-Identifier: Apache-2.0
import type { ConnectorStyle } from "nextphase-board-rules/objects/registry.ts";
export function HeadIcon({ head, start = false }: { head: ConnectorStyle["startHead"]; start?: boolean }) {
  const paths = {
    none: null,
    "line-arrow": <path d="M 12 5 L 22 12 L 12 19" />,
    "solid-arrow": <path d="M 22 12 L 10 5 L 10 19 Z" fill="currentColor" />,
    triangle: <path d="M 11 12 L 22 5 L 22 19 Z" fill="currentColor" />,
    circle: <circle cx="17" cy="12" r="5" fill="currentColor" />,
    diamond: <path d="M 22 12 L 16 6 L 10 12 L 16 18 Z" fill="currentColor" />,
  };
  return <svg width="28" height="24" viewBox="0 0 28 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
    <g transform={start ? "translate(28 0) scale(-1 1)" : undefined}><path d="M 3 12 H 22" />{paths[head]}</g>
  </svg>;
}
export function LineShapeIcon({ shape }: { shape: ConnectorStyle["lineShape"] }) {
  return <svg width="28" height="24" viewBox="0 0 28 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d={{ elbowed: "M 3 18 H 14 V 6 H 25", curved: "M 3 18 C 19 18 9 6 25 6", straight: "M 3 18 L 25 6" }[shape]} />
  </svg>;
}
export function LineStyleIcon() {
  return <svg width="28" height="24" viewBox="0 0 28 24" aria-hidden="true" stroke="currentColor">
    <path d="M 3 6 H 25" strokeWidth="1" /><path d="M 3 12 H 25" strokeWidth="2" /><path d="M 3 19 H 25" strokeWidth="2" strokeDasharray="4 3" />
  </svg>;
}
