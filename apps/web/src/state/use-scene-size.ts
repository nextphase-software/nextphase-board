// SPDX-License-Identifier: Apache-2.0
import { useEffect, useState, type RefObject } from "react";

export function useSceneSize(scene: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: innerWidth, h: innerHeight });
  useEffect(() => {
    const resize = () =>
      setSize({
        w: scene.current?.clientWidth ?? innerWidth,
        h: scene.current?.clientHeight ?? innerHeight,
      });
    resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);
  return size;
}
