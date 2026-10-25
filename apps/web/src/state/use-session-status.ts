// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";

export function useSessionStatus() {
  const [readOnly, setReadOnly] = useState(true),
    [status, setStatus] = useState("Unsaved");
  return { readOnly, setReadOnly, status, setStatus };
}
