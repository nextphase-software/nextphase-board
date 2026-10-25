// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";

export function useTextEntry() {
  const [inline, setInline] = useState(false),
    [composing, setComposing] = useState(false);
  return { inline, setInline, composing, setComposing };
}
