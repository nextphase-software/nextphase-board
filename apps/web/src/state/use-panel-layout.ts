// SPDX-License-Identifier: Apache-2.0
import { useEffect, useState, type RefObject } from "react";

export function usePanelLayout(scene: RefObject<HTMLDivElement | null>) {
  const [layout, setLayout] = useState({ notice: 80, panel: 130 });
  useEffect(() => {
    const file = document.querySelector(".file")!,
      actions = document.querySelector(".actions")!,
      notice = document.querySelector<HTMLElement>(".notice")!;
    const update = () => {
      const top = scene.current?.getBoundingClientRect().top ?? 0;
      const n = Math.max(
        file.getBoundingClientRect().bottom,
        actions.getBoundingClientRect().bottom,
      ) - top + 8;
      setLayout({
        notice: n,
        panel: n + (notice.hidden ? 0 : notice.getBoundingClientRect().height + 8),
      });
    };
    const observer = new ResizeObserver(update);
    [file, actions, notice].forEach((el) => observer.observe(el));
    update();
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  return layout;
}
