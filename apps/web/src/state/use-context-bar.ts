// SPDX-License-Identifier: Apache-2.0
import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { contextBarPosition, type ContextBarPositionInput } from "../context-bar-position.ts";

type Input = Omit<ContextBarPositionInput, "contextWidth"> & {
  selectionKey: string;
  selected: Set<string>;
  selectionReason: string;
  contextBar: RefObject<HTMLElement | null>;
  colourControl: RefObject<HTMLSpanElement | null>;
  colourButton: RefObject<HTMLButtonElement | null>;
  swatches: RefObject<HTMLDivElement | null>;
  arrangeControl: RefObject<HTMLSpanElement | null>;
  arrangeButton: RefObject<HTMLButtonElement | null>;
  arrangeMenu: RefObject<HTMLDivElement | null>;
};

export function useContextBar({
  selectionKey, selected, selectionReason, bounds, pos, view, size, layout, inline,
  item, itemHeight, contextBar, colourControl, colourButton, swatches,
  arrangeControl, arrangeButton, arrangeMenu,
}: Input) {
  const [swatchFor, setSwatchFor] = useState(""),
    [arrangeFor, setArrangeFor] = useState(""),
    [arrangeHeight, setArrangeHeight] = useState(0),
    [contextWidth, setContextWidth] = useState(0);
  useLayoutEffect(() => {
    const bar = contextBar.current;
    if (!bar) return;
    const measure = () => setContextWidth(bar.getBoundingClientRect().width);
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    measure();
    return () => observer.disconnect();
  }, [selectionKey]);
  const { contextLeft, contextTop, contextFits } = contextBarPosition({
    bounds, pos, view, size, contextWidth, layout, inline, item, itemHeight,
  });
  const swatchOpen = swatchFor === selectionKey && selected.size > 0 && contextFits && !selectionReason;
  useEffect(() => {
    if (!swatchOpen) setSwatchFor("");
  }, [swatchOpen, selectionKey]);
  useEffect(() => {
    if (!swatchOpen) return;
    (swatches.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ??
      swatches.current?.querySelector<HTMLButtonElement>("button"))?.focus();
    const outside = (event: Event) => {
      if (event.target instanceof Node && !colourControl.current?.contains(event.target)) {
        setSwatchFor("");
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
    };
  }, [swatchOpen]);
  const arrangeOpen = arrangeFor === selectionKey && selected.size > 0 && contextFits && !selectionReason;
  useEffect(() => {
    if (!arrangeOpen) setArrangeFor("");
  }, [arrangeOpen, selectionKey]);
  useLayoutEffect(() => {
    if (!arrangeOpen || !arrangeMenu.current) return;
    const menu = arrangeMenu.current;
    const measure = () => setArrangeHeight(menu.getBoundingClientRect().height);
    const observer = new ResizeObserver(measure);
    observer.observe(menu);
    measure();
    return () => observer.disconnect();
  }, [arrangeOpen]);
  useEffect(() => {
    if (!arrangeOpen) return;
    arrangeMenu.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const outside = (event: Event) => {
      if (event.target instanceof Node && !arrangeControl.current?.contains(event.target)) {
        setArrangeFor("");
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
    };
  }, [arrangeOpen]);
  function closeArrange() {
    setArrangeFor("");
    arrangeButton.current?.focus();
  }
  function closeSwatches() {
    setSwatchFor("");
    colourButton.current?.focus();
  }
  return {
    contextWidth, contextLeft, contextTop, contextFits, swatchOpen, arrangeOpen,
    arrangeHeight, setSwatchFor, setArrangeFor, closeSwatches, closeArrange,
  };
}
