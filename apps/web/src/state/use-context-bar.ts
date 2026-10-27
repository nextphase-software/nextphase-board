// SPDX-License-Identifier: Apache-2.0
import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { contextBarPosition, type ContextBarPositionInput } from "../context-bar-position.ts";

type Input = Omit<ContextBarPositionInput, "contextWidth"> & {
  selectionKey: string;
  selected: Set<string>;
  selectionReason: string;
};

export function useContextBar({
  selectionKey, selected, selectionReason, bounds, pos, view, size, layout, inline,
  item, itemHeight,
}: Input) {
  const contextBar = useRef<HTMLElement>(null),
    colourControl = useRef<HTMLSpanElement>(null),
    colourButton = useRef<HTMLButtonElement>(null),
    swatches = useRef<HTMLDivElement>(null),
    arrangeControl = useRef<HTMLSpanElement>(null),
    arrangeButton = useRef<HTMLButtonElement>(null),
    arrangeMenu = useRef<HTMLDivElement>(null);
  const controls = { kind: useRef<HTMLSpanElement>(null), fill: useRef<HTMLSpanElement>(null), border: useRef<HTMLSpanElement>(null) };
  const buttons = { kind: useRef<HTMLButtonElement>(null), fill: useRef<HTMLButtonElement>(null), border: useRef<HTMLButtonElement>(null) };
  const menu = useRef<HTMLDivElement>(null);
  const [shapeFor, setShapeFor] = useState({ key: "", name: "" });
  const [swatchFor, setColour] = useState(""),
    [arrangeFor, setArrange] = useState(""),
    [arrangeHeight, setArrangeHeight] = useState(0),
    [contextWidth, setContextWidth] = useState(0);
  function setSwatchFor(value: React.SetStateAction<string>) {
    setColour(value); setShapeFor({ key: "", name: "" }); if (value) setArrange("");
  }
  function setArrangeFor(value: React.SetStateAction<string>) {
    setArrange(value); setShapeFor({ key: "", name: "" }); if (value) setColour("");
  }
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
  const shapeOpen = shapeFor.key === selectionKey && contextFits && !selectionReason ? shapeFor.name : "";
  const shapePopup = { open: shapeOpen, controls, buttons, menu,
    toggle: (name: keyof typeof controls) => {
      setColour(""); setArrange("");
      setShapeFor({ key: selectionKey, name: shapeOpen === name ? "" : name });
    },
    close: () => {
      setShapeFor({ key: "", name: "" });
      if (shapeOpen) buttons[shapeOpen as keyof typeof buttons].current?.focus();
    },
  };
  useEffect(() => {
    if (!shapeOpen) { setShapeFor({ key: "", name: "" }); return; }
    menu.current?.querySelector<HTMLElement>('[aria-checked="true"], [aria-pressed="true"], button')?.focus();
    const outside = (event: Event) => {
      if (event.target instanceof Node && !controls[shapeOpen as keyof typeof controls].current?.contains(event.target)) {
        setShapeFor({ key: "", name: "" });
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    return () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("focusin", outside); };
  }, [shapeOpen, selectionKey]);
  const swatchOpen = swatchFor === selectionKey && selected.size > 0 && contextFits && !selectionReason;
  useEffect(() => {
    if (!swatchOpen) setColour("");
  }, [swatchOpen, selectionKey]);
  useEffect(() => {
    if (!swatchOpen) return;
    (swatches.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ??
      swatches.current?.querySelector<HTMLButtonElement>("button"))?.focus();
    const outside = (event: Event) => {
      if (event.target instanceof Node && !colourControl.current?.contains(event.target)) {
        setColour("");
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
    if (!arrangeOpen) setArrange("");
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
        setArrange("");
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
    shapePopup, contextWidth, contextLeft, contextTop, contextFits, swatchOpen, arrangeOpen,
    arrangeHeight, setSwatchFor, setArrangeFor, closeSwatches, closeArrange,
    contextBar, colourControl, colourButton, swatches, arrangeControl, arrangeButton, arrangeMenu,
  };
}
