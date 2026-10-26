// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, SetStateAction, RefObject } from "react";
import { OBJECT_TYPES, placementTool } from "../objects/registry";
import { Icon } from "../icons";

type Props = {
  tool: string;
  busy: boolean;
  composing: boolean;
  readOnly: boolean;
  setTool: Dispatch<SetStateAction<string>>;
  setInline: Dispatch<SetStateAction<boolean>>;
  scene: RefObject<HTMLDivElement | null>;
};

export function Palette({
  tool, busy, composing, readOnly, setTool, setInline, scene
}: Props) {
  return (
    <nav className="palette floating" aria-label="Board tools">
      {(["Select", "Pan", ...OBJECT_TYPES.map((t) => t.tool)] as const).map((
        name,
      ) => (
        <button
          key={name}
          className={"icon-button" + (name === OBJECT_TYPES[0].tool ? " tool-divider" : "")}
          aria-label={name + " tool"}
          aria-pressed={tool === name}
          disabled={busy || composing ||
            (readOnly && !!placementTool(name))}
          onClick={() => {
            setTool(name);
            setInline(false);
            scene.current?.focus();
          }}
        >
          <Icon name={name} />
          <span className="tooltip">{name}</span>
        </button>
      ))}
    </nav>
  );
}
