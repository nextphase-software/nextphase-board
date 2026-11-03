// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, RefObject, SetStateAction } from "react";
import { CommentIcon } from "./icons";
export function CommentTool({ tool, setTool, scene, disabled }: {
  tool: string; setTool: Dispatch<SetStateAction<string>>; scene: RefObject<HTMLDivElement | null>; disabled: boolean;
}) {
  return <button className="icon-button" aria-label="Comment tool" aria-pressed={tool === "Comment"} disabled={disabled}
    onClick={() => { setTool(tool === "Comment" ? "Select" : "Comment"); scene.current?.focus(); }}>
    <CommentIcon name="bubble" /><span className="tooltip">Comment C</span>
  </button>;
}
