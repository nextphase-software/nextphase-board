// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, SetStateAction, RefObject } from "react";
import { OBJECT_TYPES, placementTool, kindForTool, SHAPE_KINDS } from "nextphase-board-rules/objects/registry.ts";
import { DrawButton, DrawingBar, type DrawingControls } from "./drawing-tools";
import { TemplatesPanel } from "./templates-panel";
import type { Activity, Preview } from "../activities";
import { Icon } from "../icons";

import { ImageButton, type ImagePicker } from "./image-controls";

import type { TeamParts } from "../team/team-app";

type Props = {
  team?: TeamParts;
  imagePicker: ImagePicker;
  drawing: DrawingControls;
  loadTemplates: () => Promise<void>;
  panel: string;
  toggle: (name: string) => void;
  templatesButton: RefObject<HTMLButtonElement | null>;
  firstTemplateButton: RefObject<HTMLButtonElement | null>;
  addActivity: (entry: Activity) => void;
  templatePreviews: Record<string, Preview>;
  tool: string;
  busy: boolean;
  composing: boolean;
  readOnly: boolean;
  setTool: Dispatch<SetStateAction<string>>;
  setInline: Dispatch<SetStateAction<boolean>>;
  scene: RefObject<HTMLDivElement | null>;
};

export function Palette({
  imagePicker, drawing, loadTemplates, panel, toggle, templatesButton, firstTemplateButton, addActivity, templatePreviews, tool, busy, composing, readOnly, setTool, setInline, scene, team
}: Props) {
  const arm = (name: string) => { setTool(name); setInline(false); scene.current?.focus(); };
  return (
    <>
    <nav className="palette floating" aria-label="Board tools">
      {(["Select", "Pan", ...OBJECT_TYPES.flatMap((t) => t.tool ? [t.tool] : [])] as const).filter((name) => !team?.hosted || !readOnly || team.hosted.previewEditor || !placementTool(name)).flatMap((
        name,
      ) => [
        <button
          key={name}
          className={"icon-button" + (name === OBJECT_TYPES[0].tool ? " tool-divider" : "")}
          aria-label={name + " tool"}
          aria-pressed={tool === name || !!placementTool(name)?.shapePaint && !!kindForTool(tool)}
          disabled={!!team?.hosted?.history.previewing && name !== "Pan" || busy || composing ||
            (readOnly && !!placementTool(name))}
          onClick={() => {
            setTool(placementTool(name)?.shapePaint ? SHAPE_KINDS[0].tool : name);
            setInline(false);
            scene.current?.focus();
          }}
        >
          <Icon name={name} />
          <span className="tooltip">{name}{placementTool(name)?.shapePaint ? " · " + SHAPE_KINDS[0].key : ""}</span>
        </button>,
        ...(placementTool(name)?.shapePaint ? [<DrawButton key="Draw" tool={tool} drawing={drawing} disabled={readOnly || busy || composing} arm={arm} />] : []),
      ])}
      {(!(team?.hosted && readOnly) || team.hosted.previewEditor) && <button ref={templatesButton} className="icon-button" aria-label="Templates"
        aria-expanded={panel === "Templates"} aria-pressed={panel === "Templates"}
        disabled={readOnly || busy || composing} onClick={() => { if (panel !== "Templates") void loadTemplates(); toggle("Templates"); }}>
        <Icon name="Templates" /><span className="tooltip">Templates</span>
      </button>}
      {!team?.hosted && <ImageButton picker={imagePicker} />}
      {team?.commentTool && <team.commentTool tool={tool} setTool={setTool} scene={scene} disabled={busy || composing || !!team?.hosted?.history.previewing || !!team?.hosted?.history.locked} />}
    </nav>
    <DrawingBar tool={tool} drawing={drawing} disabled={readOnly || busy || composing} arm={arm} />
    {panel === "Templates" && <TemplatesPanel close={() => toggle("Templates")} addActivity={addActivity}
      previews={templatePreviews} firstButton={firstTemplateButton} disabled={readOnly || busy || composing} />}
    </>
  );
}
