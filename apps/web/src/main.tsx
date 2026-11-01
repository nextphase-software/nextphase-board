// SPDX-License-Identifier: Apache-2.0
import { createRoot } from "react-dom/client";
import { App } from "./App";
declare const BOARD_TEAM_FEATURES: boolean;
const root = createRoot(document.getElementById("root")!);
if (BOARD_TEAM_FEATURES) {
  void import("./team/team-app").then(({ TeamApp }) => root.render(<TeamApp />));
} else root.render(<App />);
