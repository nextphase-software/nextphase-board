// SPDX-License-Identifier: Apache-2.0
import { useRef, useState } from "react";
import { noticeMessage } from "../notice-message.ts";

export function useMessages() {
  const [message, setMessageState] = useState("Opening local board…");
  const messageSequence = useRef(0);
  function setMessage(value: string) {
    messageSequence.current++;
    setMessageState(value);
  }
  const { acknowledgement, visibleMessage } = noticeMessage(message);
  const latestAcknowledgement = useRef("");
  if (acknowledgement) latestAcknowledgement.current = message;
  return { setMessage, messageSequence, latestAcknowledgement, visibleMessage };
}
