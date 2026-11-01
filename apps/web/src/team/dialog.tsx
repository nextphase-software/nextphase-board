// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, type ReactNode } from "react";

type Props = { title: string; className?: string; close: () => void;
  escape?: () => boolean; children: ReactNode };
export function TeamDialog({ title, className = "", close, escape, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    const node = dialog.current!;
    node.showModal();
    (node.querySelector<HTMLElement>("input:not([disabled])")
      ?? node.querySelector<HTMLElement>("button:not([disabled])"))?.focus();
    return () => {
      node.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  return <dialog ref={dialog} className={"team-dialog " + className} aria-label={title}
    onCancel={(event) => { event.preventDefault(); if (!escape?.()) close(); }}
    onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        if (!escape?.()) close();
      }
      if (event.key === "Tab") {
        const controls = [...dialog.current!.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"],a[href]',
        )].filter((node) => node.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
    {children}
  </dialog>;
}
