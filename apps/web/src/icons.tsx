// SPDX-License-Identifier: Apache-2.0
import { SHAPE_KINDS } from "nextphase-board-rules/objects/registry.ts";
// Original glyphs for the Board shell; no external artwork inputs.
const paths = {
  Select: "M4 3 16 11 10 12 7 17Z",
  Pan: "M6 10V5a1.5 1.5 0 0 1 3 0v4-6a1.5 1.5 0 0 1 3 0v6-4a1.5 1.5 0 0 1 3 0v5-2a1.5 1.5 0 0 1 3 0v5c0 4-2 6-6 6h-1c-2 0-3-1-4-3l-3-4a1.5 1.5 0 0 1 2-2l2 2",
  Sticky: "M4 3h12v9l-5 5H4ZM11 17v-5h5",
  Shapes: "M2 2h10v10H2ZM18 13a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
  Square: "M3 3h14v14H3Z",
  Circle: "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  Border: "M3 5h14M3 10h14M3 15h14",
  Section: "M4 3h6M3 7h14v10H3Z",
  Templates: "M3 3h14v14H3ZM3 7h14M10 7v10",
  "Mind map": "M3.5 8h3a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1ZM13.5 3h3a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM13.5 13h3a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1ZM7.5 10c2.5 0 2.5-5 5-5M7.5 10c2.5 0 2.5 5 5 5",
  Collapse: "M4 10h5M17 10a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0M12 10h3",
  Expand: "M4 10h5M17 10a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0M12 10h3M13.5 8.5v3",
  Text: "M4 4h12M10 4v13M7 17h6M4 4v2M16 4v2",
  minus: "M4 10h12",
  plus: "M4 10h12M10 4v12",
  navigation: "M10 2v16M2 10h16M7 5l3-3 3 3M7 15l3 3 3-3M5 7l-3 3 3 3M15 7l3 3-3 3",
  objects: "M8 5h9M8 10h9M8 15h9M3 5h1M3 10h1M3 15h1",
  "chevron-up": "M5 12.5 L10 7.5 L15 12.5",
  close: "M5.5 5.5 L14.5 14.5 M14.5 5.5 L5.5 14.5",
  search: "M13.2 13.2 L17 17",
  chevron: "m5 8 5 5 5-5",
  pencil: "m4 12 9-9 4 4-9 9-5 1ZM11 5l4 4",
  information: "M10 9v5M10 6h.01M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  status: "M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0M10 7v3l2 2",
  Undo: "M7 4 3 8l4 4M3 8h8a5 5 0 0 1 0 10",
  Redo: "m13 4 4 4-4 4M17 8H9a5 5 0 0 0 0 10",
  Arrange: "M3 3h9v6H3ZM8 11h9v6H8ZM3 13v4h3M14 3h3v6",
  Duplicate: "M7 7h10v10H7ZM3 13V3h10",
  left: "M3 4h14M3 8h9M3 12h14M3 16h9",
  center: "M3 4h14M6 8h8M3 12h14M6 16h8",
  right: "M3 4h14M8 8h9M3 12h14M8 16h9",
  bold: "M6 3h5a3.5 3.5 0 0 1 0 7H6Zm0 7h6a3.5 3.5 0 0 1 0 7H6Z",
  italic: "M9 3h7M4 17h7M13 3 7 17",
  strike: "M15 5c-1-2-9-3-9 1 0 2 2 3 4 4M5 15c1 3 10 3 10-1 0-2-2-3-5-4M3 10h14",
  Done: "m4.5 10.5 3.5 3.5 7.5-8",
  "Delete content": "m8 16-4-4 7.5-7.5 4 4L8 16Zm0 0h8M6 10l4 4",
  "Export as CSV": "M10 3.5v9m-3.5-3.5 3.5 3.5 3.5-3.5M4 13.5v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2",
  "Delete axis": "M4 6h12M8 6V4h4v2m-6 0 .7 10h6.6L14 6",
  Delete: "M3 5h14M7 5V3h6v2M5 5l1 12h8l1-12M8 8v6M12 8v6",
};
const tableIcons = {
  Table: [3, 4, 14, 12, 2, "M3 8.5h14M3 12.3h14M8 4v12"],
  "Add row": [3, 3, 14, 8, 1.5, "M3 7h14M10 13.5v4M8 15.5h4"],
  "Add column": [3, 3, 8, 14, 1.5, "M7 3v14M13.5 10h4M15.5 8v4"],
  "Row options": [2.5, 7, 15, 6, 1.5, "M6 3.5h8M6 16.5h8"],
  "Column options": [7, 2.5, 6, 15, 1.5, "M3.5 6v8M16.5 6v8"],
} as const;
export function Icon({ name }: { name: keyof typeof paths | keyof typeof tableIcons | typeof SHAPE_KINDS[number]['tool'] | 'Tidy up' | 'Washi tape' | 'pages' | 'move-page' | 'page-plus' | 'page-more' }) {
  if (name === 'page-more') return <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">{[5,10,15].map(x => <circle key={x} cx={x} cy="10" r="1.5" />)}</svg>;
  if (name === 'pages' || name === 'move-page' || name === 'page-plus') return <svg width={name === 'page-plus' ? 18 : 20} height={name === 'page-plus' ? 18 : 20} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={name === 'page-plus' ? 1.75 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'page-plus' ? <path d="M10 4.5v11M4.5 10h11" /> : name === 'pages' ? <><rect x="6.5" y="3.5" width="10" height="11" rx="2" /><path d="M13.5 16.5h-8a2 2 0 0 1-2-2v-8" /></> : <><rect x="3.5" y="3.5" width="9" height="11" rx="2" /><path d="M10 11h7m-2.5-2.5L17 11l-2.5 2.5" /></>}
  </svg>;
  if (name === 'Washi tape') return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M3 9.5 4.2 8 3 6.5 20 3l1 4.5-1.2 1.5L21 10.5 4 14z" /><path d="M7 7.5l1.6 5.4M12 6.5l1.6 5.4M17 5.5l1.2 5" strokeWidth="1.2" /><path d="M5 19h14" strokeWidth="2.4" strokeLinecap="round" /></svg>;
  if (Object.hasOwn(tableIcons, name)) {
    const [x, y, width, height, rx, d] = tableIcons[name as keyof typeof tableIcons];
    return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><rect {...{ x, y, width, height, rx }} /><path d={d} /></svg>;
  }
  const kind = SHAPE_KINDS.find(k => k.name === name && !k.key), outline = kind?.outline;
  const polygon = Array.isArray(outline) ? outline.map(([x,y],i) => `${i?'L':'M'}${1+x*18} ${1+y*18}`).join(' ')+'Z' : undefined;
  return <svg width={name === "search" ? 18 : 20} height={name === "search" ? 18 : 20} viewBox="0 0 20 20" fill="none"
    stroke="currentColor" strokeWidth={name === "Export as CSV" ? 1.6 : 1.75} strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === "search" && <circle cx="9" cy="9" r="5.5" />}
    {name === 'Tidy up' ? [[2.5,2.5],[11.5,2.5],[2.5,11.5],[11.5,11.5]].map(([x,y],i) => <rect key={i} x={x} y={y} width={6} height={6} rx={1} />)
      : kind ? polygon ? <path d={polygon} /> : <rect x={1} y={1} width={18} height={18} rx={18*.18} /> : <path d={paths[name as keyof typeof paths]} />}
  </svg>;
}
