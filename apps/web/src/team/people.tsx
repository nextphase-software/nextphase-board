// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { HostedBoard } from "./hosted-board";
import { avatarPeople, groupPeople } from "./presence";
import { roleWords } from "./roles";

export function People({ hosted }: { hosted: HostedBoard }) {
  const snapshot = useSyncExternalStore(hosted.subscribePresence, hosted.getPresence);
  const [open, setOpen] = useState(false), [width, setWidth] = useState(innerWidth);
  const group = useRef<HTMLDivElement>(null), menu = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const people = groupPeople(snapshot.self, snapshot.others);
  const { shown, overflow } = avatarPeople(people, width);
  const followed = snapshot.others.find((other) => other.connection === snapshot.followed);
  useEffect(() => {
    const resize = () => setWidth(innerWidth);
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !group.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("resize", resize);
    document.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("pointerdown", outside);
    };
  }, []);
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);
  function show(button: HTMLButtonElement) {
    opener.current = button;
    setOpen((value) => !value);
  }
  // The save panel creates a stacking context below presence. Portal the menu
  // so its layer can sit above presence without raising the entire save panel.
  const groupBox = group.current?.getBoundingClientRect();
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  return <div className="presence-people" ref={group} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget) && !menu.current?.contains(event.relatedTarget)) setOpen(false);
  }}>
    <ul aria-label="People on this board">
      {shown.map((person) => {
        const { first, own } = person;
        return <li key={person.person}><button className="presence-avatar"
          style={{ background: first.colour, outline: followed?.person === person.person ? `2px solid ${followed.colour}` : undefined,
            outlineOffset: followed?.person === person.person ? 1 : undefined }}
          title={first.label + (own ? " (you)" : "")}
          aria-label={own ? `${first.label} (you), ${roleWords(first.role)}. Open people menu`
            : `Follow ${first.label}, ${roleWords(first.role)}`}
          onClick={(event) => own ? show(event.currentTarget) : hosted.follow(person.person)}>
          {first.label.slice(0, 1).toUpperCase()}
        </button></li>;
      })}
      {overflow > 0 && <li><button className="presence-overflow" aria-label={`Show ${overflow} more people`}
        aria-haspopup="menu" aria-expanded={open} onClick={(event) => show(event.currentTarget)}>+{overflow}</button></li>}
      <li><button className="presence-chevron" aria-label={`People on this board: ${people.length}`}
        aria-haspopup="menu" aria-expanded={open} onClick={(event) => show(event.currentTarget)}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#3b3a40"
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 8 4 4 4-4" />
        </svg>
      </button></li>
    </ul>
    {open && groupBox && createPortal(<div className="presence-menu" ref={menu} role="menu" aria-label="People on this board"
      style={{ top: groupBox.bottom + 14, right: width < 768 ? 12 : width - groupBox.right - 8 }}
      onKeyDown={(event) => {
        // The cursor shortcut is handled in document capture, before this menu
        // keeps every other key away from the board's own key handling.
        event.stopPropagation();
        const items = [...menu.current!.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"]')];
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
          : event.key === "ArrowDown" ? (index + 1) % items.length
            : event.key === "ArrowUp" ? (index - 1 + items.length) % items.length : -1;
        if (next >= 0) { event.preventDefault(); items[next]?.focus(); }
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); opener.current?.focus(); }
        if (event.key === "Tab") {
          event.preventDefault();
          // The portal is last in the DOM, but Tab must continue from the
          // menu's logical place after the people group's chevron.
          const controls = [...document.querySelectorAll<HTMLElement>(
            'button, input, textarea, select, a[href], [tabindex]',
          )].filter((node) => node.tabIndex >= 0 && !node.matches(":disabled") &&
            !menu.current?.contains(node) && node.getClientRects().length > 0);
          const chevron = group.current!.querySelector<HTMLButtonElement>(".presence-chevron")!;
          const next = event.shiftKey ? chevron : controls[controls.indexOf(chevron) + 1];
          setOpen(false);
          next?.focus();
        }
      }}>
      {people.map(({ person, first, own }) => <button key={person} role="menuitem" tabIndex={-1}
        className="presence-person" onClick={() => {
          if (!own) { hosted.follow(person); setOpen(false); opener.current?.focus(); }
        }}>
        <span className="presence-dot" style={{ background: first.colour }}>{first.label.slice(0, 1).toUpperCase()}</span>
        <span className="presence-person-label">{first.label}{own ? " (you)" : ""}<small>{roleWords(first.role)}</small></span>
        {!own && <span className="presence-follow-word">Follow</span>}
      </button>)}
      <div role="separator" />
      <button role="menuitemcheckbox" aria-checked={snapshot.showCursors} tabIndex={-1}
        className="presence-cursor-switch" onClick={hosted.toggleCursors}>
        <span aria-hidden="true">{snapshot.showCursors ? "✓" : ""}</span>
        <span>Show other people's cursors</span><small>{mac ? "⌥⌘\\" : "Ctrl+Alt+\\"}</small>
      </button>
    </div>, document.body)}
  </div>;
}
