// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useSyncExternalStore, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { HostedBoard } from "../team/hosted-board";
import type { View } from "../view";

type Input = {
  hosted: HostedBoard;
  scene: RefObject<HTMLDivElement | null>;
  selected: Set<string>;
  view: View;
  size: { w: number; h: number };
  setFollowView: Dispatch<SetStateAction<View>>;
};

export function usePresence({ hosted, scene, selected, view, size, setFollowView }: Input) {
  const snapshot = useSyncExternalStore(hosted.subscribePresence, hosted.getPresence);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const latest = useRef({ selected, view, size });
  latest.current = { selected, view, size };
  const selectionKey = [...selected].join(",");
  function send() {
    const { selected, view, size } = latest.current;
    const rect = scene.current?.getBoundingClientRect();
    const cursor = pointer.current && rect ? {
      x: view.x + (pointer.current.x - rect.left - size.w / 2) / view.z,
      y: view.y + (pointer.current.y - rect.top - size.h / 2) / view.z,
    } : null;
    hosted.sendPresence(cursor, selected, view, size, document.visibilityState === "visible");
  }
  useEffect(() => {
    const track = (event: PointerEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const surface = target?.closest(".scene, .inline");
      const overBoard = surface && (surface === scene.current || surface.classList.contains("inline"));
      pointer.current = overBoard && !target?.closest("button, [role=button]")
        ? { x: event.clientX, y: event.clientY } : null;
      send();
    };
    const leave = (event: PointerEvent) => {
      if (event.relatedTarget === null) { pointer.current = null; send(); }
    };
    const keys = (event: KeyboardEvent) => {
      if (event.isComposing || event.target instanceof Element && event.target.closest(".team-dialog")) return;
      const mac = /Mac|iPhone|iPad/.test(navigator.platform);
      const shortcut = event.code === "Backslash" && event.altKey && !event.shiftKey &&
        (mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey);
      if (shortcut) {
        event.preventDefault(); event.stopPropagation(); hosted.toggleCursors();
      } else if (event.key === "Escape" && hosted.presence.followed &&
        !(event.target instanceof Element && event.target.closest('[role="menu"]'))) {
        event.preventDefault(); event.stopPropagation(); hosted.stopFollowing();
      }
    };
    document.addEventListener("pointermove", track, true);
    document.addEventListener("pointerover", track, true);
    document.addEventListener("pointerout", leave, true);
    document.addEventListener("visibilitychange", send);
    document.addEventListener("keydown", keys, true);
    return () => {
      document.removeEventListener("pointermove", track, true);
      document.removeEventListener("pointerover", track, true);
      document.removeEventListener("pointerout", leave, true);
      document.removeEventListener("visibilitychange", send);
      document.removeEventListener("keydown", keys, true);
    };
  }, [hosted]);
  useEffect(() => { send(); }, [hosted, snapshot.self?.connection, selectionKey, view, size.w, size.h]);
  const followed = snapshot.others.find((other) => other.connection === snapshot.followed);
  useEffect(() => {
    const next = hosted.followView(size);
    if (next) setFollowView(next);
  }, [hosted, followed, size.w, size.h, setFollowView]);
  return { ...snapshot, followed };
}
