// SPDX-License-Identifier: Apache-2.0
export type End = { object: string; anchor: "auto" };
export type EndsKeys = { from: End; to: End };
const fixedStyle = { color: "neutral", textSize: "medium", align: "center" } as const;
function validEnd(value: unknown): boolean {
  const end = value as End;
  return !!end && typeof end === "object" && Object.keys(end).sort().join() === "anchor,object" &&
    typeof end.object === "string" && end.anchor === "auto";
}
export const connector = {
  type: "connector", label: "Connector", tool: null, validFrom: 7, body: "connector-body",
  points: false, text: true, ends: true, container: false, richText: false, textLimit: 100, initialText: "",
  draws: false, kinds: [] as readonly { kind: string; tool: string; key: string; round: boolean }[],
  shapePaint: false, growsWithText: false, previewRadius: 0,
  defaultStyle: fixedStyle, legacyStyle: fixedStyle,
  extraKeys: ["from", "to"] as readonly string[], defaults: () => ({}),
  validExtras: (value: object) => {
    const o = value as EndsKeys & typeof fixedStyle & { group: unknown; section: unknown; marks: unknown[] };
    return validEnd(o.from) && validEnd(o.to) && o.color === fixedStyle.color &&
      o.textSize === fixedStyle.textSize && o.align === fixedStyle.align &&
      o.group === null && o.section === null && Array.isArray(o.marks) && o.marks.length === 0;
  },
  fontSize: (_o: object) => 18, labelPrefix: (_o: object) => "connector",
  fill: (_o: object) => undefined, edge: (_o: object) => "#6b6b6b",
  textColor: (_o: object) => "#2c2c2c",
} as const;
