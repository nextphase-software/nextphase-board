// SPDX-License-Identifier: Apache-2.0
// Original glyphs for the Board shell; no external artwork inputs.
const paths = {
  Select: "M4 3 16 11 10 12 7 17Z",
  Pan: "M6 10V5a1.5 1.5 0 0 1 3 0v4-6a1.5 1.5 0 0 1 3 0v6-4a1.5 1.5 0 0 1 3 0v5-2a1.5 1.5 0 0 1 3 0v5c0 4-2 6-6 6h-1c-2 0-3-1-4-3l-3-4a1.5 1.5 0 0 1 2-2l2 2",
  Sticky: "M4 3h12v9l-5 5H4ZM11 17v-5h5",
  Section: "M4 3h6M3 7h14v10H3Z",
  Text: "M4 4h12M10 4v13M7 17h6M4 4v2M16 4v2",
  minus: "M4 10h12",
  plus: "M4 10h12M10 4v12",
  navigation: "M10 2v16M2 10h16M7 5l3-3 3 3M7 15l3 3 3-3M5 7l-3 3 3 3M15 7l3 3-3 3",
  objects: "M8 5h9M8 10h9M8 15h9M3 5h1M3 10h1M3 15h1",
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
  Delete: "M3 5h14M7 5V3h6v2M5 5l1 12h8l1-12M8 8v6M12 8v6",
};
export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={paths[name]} />
  </svg>;
}
