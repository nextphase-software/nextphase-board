// SPDX-License-Identifier: Apache-2.0
import { useEffect, useState, type RefObject } from "react";

export function usePanelLayout(scene: RefObject<HTMLDivElement | null>) {
  const [layout, setLayout] = useState({ notice: 80, panel: 130, columnNotice: undefined as number | undefined });
  useEffect(() => {
    const file = document.querySelector(".file")!,
      actions = document.querySelector(".actions")!,
      notice = document.querySelector<HTMLElement>(".notice");
    const main = scene.current?.parentElement;
    let column: HTMLElement | null = null;
    const updateColumn = () => {
      const top = scene.current?.getBoundingClientRect().top ?? 0;
      const columnNotice = column ? column.getBoundingClientRect().bottom - top + 8 : undefined;
      setLayout(previous => previous.columnNotice === columnNotice ? previous : { ...previous, columnNotice });
    };
    const update = () => {
      const top = scene.current?.getBoundingClientRect().top ?? 0;
      const n = Math.max(
        file.getBoundingClientRect().bottom,
        actions.getBoundingClientRect().bottom,
      ) - top + 8;
      const panel = n + (!notice || notice.hidden ? 0 : notice.getBoundingClientRect().height + 8);
      setLayout(previous => ({ ...previous, notice: n, panel }));
    };
    const observer = new ResizeObserver(update);
    [file, actions, notice].forEach((el) => { if (el) observer.observe(el); });
    update();

    // Team chrome can change between the original layout measurements.
    // Its observers update only the notice's visual offset.
    const columnObserver = new ResizeObserver(updateColumn);
    const measureColumn = () => {
      const next = main?.querySelector<HTMLElement>(":scope > .team-notice-column") ?? null;
      if (!column && !next) return;
      if (next !== column) {
        if (column) columnObserver.unobserve(column);
        if (next) columnObserver.observe(next);
        column = next;
      }
      updateColumn();
    };
    // The column and the follow banner (which can move it) are children of main.
    const mutations = main ? new MutationObserver(measureColumn) : null;
    mutations?.observe(main!, { childList: true });
    measureColumn();
    const resize = () => { update(); if (column) updateColumn(); };
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      columnObserver.disconnect();
      mutations?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);
  return { notice: layout.columnNotice ?? layout.notice, panel: layout.panel };
}
