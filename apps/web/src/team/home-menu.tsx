// SPDX-License-Identifier: Apache-2.0
import { useLayoutEffect, useRef } from "react";
import { placeMenu } from "./home-rules";

export type MenuEntry = { kind: "label"; text: string } | { kind: "divider" }
  | { kind: "item"; text: string; run: () => void; checked?: boolean; initial?: boolean };
export type MenuPosition = { point: { x: number; y: number }; opener: HTMLElement };

export function HomeMenu({ entries, position, close }: {
  entries: MenuEntry[]; position: MenuPosition; close: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const dismiss = (focus: boolean) => { if (focus) position.opener.focus(); close(); };
  useLayoutEffect(() => {
    const node = menu.current!;
    const size = node.getBoundingClientRect();
    const placed = placeMenu(position.point, size, { width: innerWidth, height: innerHeight });
    node.style.left = placed.left + "px";
    node.style.top = placed.top + "px";
    const items = node.querySelectorAll<HTMLButtonElement>("button");
    const first = entries.filter((entry) => entry.kind === "item").findIndex((entry) => entry.initial);
    items[Math.max(0, first)]?.focus();
    const outside = (event: PointerEvent) => {
      if (!node.contains(event.target as Node)) dismiss(false);
    };
    const resize = () => dismiss(true);
    window.addEventListener("pointerdown", outside);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <div ref={menu} className="home-menu" role="menu" onKeyDown={(event) => {
    event.stopPropagation();
    if (event.key === "Tab") { dismiss(true); return; }
    if (event.key === "Escape") { event.preventDefault(); dismiss(true); return; }
    const items = [...menu.current!.querySelectorAll<HTMLButtonElement>("button")];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? (index + 1) % items.length
      : event.key === "ArrowUp" ? (index + items.length - 1) % items.length
      : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
    if (next >= 0) { event.preventDefault(); items[next]?.focus(); }
  }}>
    {entries.map((entry, index) => entry.kind === "label"
      ? <div className="home-menu-label" key={index}>{entry.text}</div>
      : entry.kind === "divider" ? <div role="separator" key={index} />
      : <button key={index} role={entry.checked === undefined ? "menuitem" : "menuitemradio"}
        aria-checked={entry.checked} tabIndex={-1} onClick={() => { dismiss(true); entry.run(); }}>
        {entry.checked && <span className="home-menu-tick" aria-hidden="true">✓</span>}{entry.text}
      </button>)}
  </div>;
}
