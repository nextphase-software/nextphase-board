// SPDX-License-Identifier: Apache-2.0
export const COLORS = [
  { name: "rose", label: "Rose", fill: "#f2dce5", edge: "#e8cdd7", text: "#8d2036" },
  { name: "yellow", label: "Yellow", fill: "#f8e9a6", edge: "#e9db9c", text: "#6b5200" },
  { name: "orange", label: "Orange", fill: "#f9d9bd", edge: "#eaccb2", text: "#8a3f0a" },
  { name: "green", label: "Green", fill: "#d6ecc9", edge: "#c9debd", text: "#2f6431" },
  { name: "teal", label: "Teal", fill: "#cbe9e3", edge: "#bfdbd5", text: "#1f5f57" },
  { name: "blue", label: "Blue", fill: "#d4e3f8", edge: "#c7d5e9", text: "#2a55a0" },
  { name: "violet", label: "Violet", fill: "#e2dbf6", edge: "#d4cee7", text: "#5b3fb5" },
  { name: "neutral", label: "Neutral", fill: "#e9e7ed", edge: "#dbd9df", text: "#28272c" },
] as const;
export const TEXT_SIZES = [
  { name: "small", label: "Small", units: 14 },
  { name: "medium", label: "Medium", units: 18 },
  { name: "large", label: "Large", units: 24 },
  { name: "extra-large", label: "Extra large", units: 32 },
] as const;
export const ALIGNMENTS = [
  { name: "left", label: "Left", action: "Align left" },
  { name: "center", label: "Centre", action: "Align centre" },
  { name: "right", label: "Right", action: "Align right" },
] as const;
export type Style = {
  color: typeof COLORS[number]["name"];
  textSize: typeof TEXT_SIZES[number]["name"];
  align: typeof ALIGNMENTS[number]["name"];
};
export const DEFAULT_STYLES = {
  sticky: { color: "rose", textSize: "medium", align: "left" },
  text: { color: "neutral", textSize: "medium", align: "left" },
} as const satisfies Record<"sticky" | "text", Style>;
export const LEGACY_STYLES = DEFAULT_STYLES;
export const STICKY_TEXT = "#28272c";
export const colorEntry = (color: Style["color"]) => COLORS.find((c) => c.name === color)!;
export const textUnits = (size: Style["textSize"]) => TEXT_SIZES.find((s) => s.name === size)!.units;
export const textColor = (object: Style & { type: "sticky" | "text" }) =>
  object.type === "sticky" ? STICKY_TEXT : colorEntry(object.color).text;

export function commonStyle<K extends keyof Style>(objects: readonly Style[], key: K): Style[K] | "" {
  const value = objects[0]?.[key];
  return value && objects.every((o) => o[key] === value) ? value : "";
}
