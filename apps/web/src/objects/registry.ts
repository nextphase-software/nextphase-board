// SPDX-License-Identifier: Apache-2.0
import { sticky } from "./sticky.ts";
import { text } from "./text.ts";

export type ObjectType = typeof sticky | typeof text;
export const OBJECT_TYPES: readonly ObjectType[] = [sticky, text];

export function objectType(type: string): ObjectType {
  const record = OBJECT_TYPES.find((t) => t.type === type);
  if (!record) throw new Error("Unknown object type: " + type);
  return record;
}

export function typeForTool(tool: string): ObjectType["type"] {
  const record = OBJECT_TYPES.find((t) => t.tool === tool);
  if (!record) throw new Error("Unknown object tool: " + tool);
  return record.type;
}
