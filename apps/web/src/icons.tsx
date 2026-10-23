// SPDX-License-Identifier: Apache-2.0
// Original glyphs for the Board shell; no external artwork inputs.
const paths = {
  Select: "M4 3 16 11 10 12 7 17Z",
  Pan: "M6 10V5a1.5 1.5 0 0 1 3 0v4-6a1.5 1.5 0 0 1 3 0v6-4a1.5 1.5 0 0 1 3 0v5-2a1.5 1.5 0 0 1 3 0v5c0 4-2 6-6 6h-1c-2 0-3-1-4-3l-3-4a1.5 1.5 0 0 1 2-2l2 2",
  Sticky: "M4 3h12v9l-5 5H4ZM11 17v-5h5",
  Text: "M4 4h12M10 4v13M7 17h6M4 4v2M16 4v2",
  minus: "M4 10h12",
  plus: "M4 10h12M10 4v12",
  navigation: "M10 2v16M2 10h16M7 5l3-3 3 3M7 15l3 3 3-3M5 7l-3 3 3 3M15 7l3 3-3 3",
  objects: "M8 5h9M8 10h9M8 15h9M3 5h1M3 10h1M3 15h1",
  chevron: "m5 8 5 5 5-5",
  pencil: "m4 12 9-9 4 4-9 9-5 1ZM11 5l4 4",
  information: "M10 9v5M10 6h.01M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  status: "M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0M10 7v3l2 2",
};
export function Icon({ name }: { name: keyof typeof paths }) {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={paths[name]} />
  </svg>;
}
