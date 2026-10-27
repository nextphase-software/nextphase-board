// SPDX-License-Identifier: Apache-2.0
import { file as retrospective } from "./retrospective.ts";
import { file as brainstorm } from "./brainstorm.ts";
import { file as kanban } from "./kanban.ts";

export const catalog = [
  { id: "retrospective", name: "Retrospective", description: "Look back together: what went well, what to improve, actions.", author: "NextPhase", license: "Apache-2.0", version: 1, file: retrospective },
  { id: "brainstorm", name: "Brainstorm", description: "A topic in the middle and ideas around it.", author: "NextPhase", license: "Apache-2.0", version: 1, file: brainstorm },
  { id: "kanban", name: "Kanban", description: "Track work from to do, through doing, to done.", author: "NextPhase", license: "Apache-2.0", version: 1, file: kanban },
] as const;
