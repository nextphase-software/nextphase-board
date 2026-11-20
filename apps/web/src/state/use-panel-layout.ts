// SPDX-License-Identifier: Apache-2.0
import { useEffect, useState, type RefObject } from "react";

export function usePanelLayout(scene: RefObject<HTMLDivElement | null>) {
  const [layout, setLayout] = useState({ notice: 80, panel: 130 });
  useEffect(() => {
    const file = document.querySelector(".file")!,
      actions = document.querySelector(".actions")!,
      notice = document.querySelector<HTMLElement>(".notice");
    const main = scene.current?.parentElement;
    let column: HTMLElement | null = null;
    const update = () => {
      const top = scene.current?.getBoundingClientRect().top ?? 0;
      const n = Math.max(
        file.getBoundingClientRect().bottom,
        actions.getBoundingClientRect().bottom,
      ) - top + 8;
      const next = {
        notice: column ? column.getBoundingClientRect().bottom - top + 8 : n,
        panel: n + (!notice || notice.hidden ? 0 : notice.getBoundingClientRect().height + 8),
      };
      setLayout(previous => previous.notice === next.notice && previous.panel === next.panel ? previous : next);
    };
    const observer = new ResizeObserver(update);
    [file, actions, notice].forEach((el) => { if (el) observer.observe(el); });
    const measureColumn = () => {
      const next = main?.querySelector<HTMLElement>(":scope > .team-notice-column") ?? null;
      if (next !== column) {
        if (column) observer.unobserve(column);
        if (next) observer.observe(next);
        column = next;
      }
      update();
    };
    // The column and the follow banner (which can move it) are children of main.
    const mutations = main ? new MutationObserver(measureColumn) : null;
    mutations?.observe(main!, { childList: true });
    measureColumn();
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      mutations?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  return layout;
}
