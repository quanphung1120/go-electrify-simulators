import * as Ably from "ably";
import { SharedState } from "./state";
import {
  registerHeartbeatHandler,
  registerSessionHandlers,
  registerCarInfoHandler,
  registerChargingHandler,
} from "./ably-handlers";

export function setupAblyIntegration(state: SharedState) {
  const realtimeClient = new Ably.Realtime({
    token: state.handshakeResponse?.data.ablyToken,
  });

  const channel = realtimeClient.channels.get(
    state.handshakeResponse!.channelId
  );

  // Store Ably client and channel in state for cleanup later
  state.ablyRealtimeClient = realtimeClient;
  state.ablyChannel = channel;

  // Register all Ably event handlers
  registerSessionHandlers(channel, state);
  registerHeartbeatHandler(channel, state);
  registerCarInfoHandler(channel, state);
  registerChargingHandler(realtimeClient, channel, state);

  return { realtimeClient, channel };
}
