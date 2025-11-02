import { SharedState } from "../state";
import { ABLY_EVENTS } from "@go-electrify/shared-types";

export const registerHeartbeatHandler = (
  channel: any,
  state: SharedState
): void => {
  // Store heartbeat interval in state for cleanup
  state.heartbeatInterval = setInterval(() => {
    if (state.ablyChannel && state.ablyRealtimeClient) {
      try {
        channel.publish(ABLY_EVENTS.DOCK_HEARTBEAT, {
          timestamp: new Date().toISOString(),
        });
        console.log("Published dock heartbeat to Ably");
      } catch (error) {
        console.error("Failed to publish heartbeat:", error);
      }
    }
  }, 10000);
};
