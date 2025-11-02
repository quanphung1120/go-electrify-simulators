import { SharedState } from "../state";
import { ABLY_EVENTS } from "@go-electrify/shared-types";
import type { SessionSpecsMessage } from "@go-electrify/shared-types";

export const registerSessionHandlers = (
  channel: any,
  state: SharedState
): void => {
  const handleSessionSpecs = (message: any): void => {
    const specs: SessionSpecsMessage = message.data;
    console.log("Session specs received:", specs);
  };

  channel.subscribe(ABLY_EVENTS.SESSION_SPECS, handleSessionSpecs);
};
