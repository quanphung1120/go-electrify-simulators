import * as Ably from "ably";
import { SharedState } from "./state";
import { startChargingSimulation } from "./chargingSimulation";
import { ABLY_EVENTS } from "@go-electrify/shared-types";
import type {
  StartSessionMessage,
  SessionSpecsMessage,
} from "@go-electrify/shared-types";

export function setupAblyIntegration(state: SharedState) {
  const BACKEND_URL = process.env.BACKEND_URL || "";

  const realtimeClient = new Ably.Realtime({
    token: state.handshakeResponse?.data.ablyToken,
  });

  const channel = realtimeClient.channels.get(
    state.handshakeResponse!.channelId
  );

  // Store Ably client and channel in state for cleanup later
  state.ablyRealtimeClient = realtimeClient;
  state.ablyChannel = channel;

  channel.subscribe(ABLY_EVENTS.SESSION_SPECS, (message: any) => {
    const specs: SessionSpecsMessage = message.data;
    console.log("Session specs received:", specs);
  });

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

  channel.subscribe(ABLY_EVENTS.LOAD_CAR_INFO, (message: any) => {
    console.log("Load car info event received:", message.data);
    const publishData = {
      currentCapacity: state.currentCapacity,
      maxCapacity: state.maxCapacity,
      timestamp: new Date().toISOString(),
    };
    console.log("Publishing car info to Ably:", publishData);
    channel.publish(ABLY_EVENTS.CAR_INFO, publishData);
  });

  channel.subscribe(ABLY_EVENTS.START_SESSION, async (message: any) => {
    const sessionData: StartSessionMessage = message.data;
    console.log("Start charging event received:", sessionData);

    if (state.isCharging) {
      console.log(
        "Charging already in progress, rejecting start_charging request"
      );
      return;
    }

    if (!state.connectedSocket || state.connectedClients === 0) {
      console.log("No car connected, cannot start charging");
      return;
    }

    if (sessionData.targetSOC) {
      state.targetSOC = sessionData.targetSOC;
      console.log(`Target SOC set to: ${state.targetSOC}%`);
    }

    // Start charging simulation
    state.isCharging = true;
    console.log("Starting charging simulation...");

    // Notify backend that charging has started
    const jwtToken = state.handshakeResponse?.data.dockJwt;
    console.log("DOCK JWT:", jwtToken);
    console.log("JWT Length:", jwtToken?.length);

    try {
      const requestBody = {
        SessionId: state.handshakeResponse!.data.sessionId,
        TargetSoc: state.targetSOC,
      };

      const response = await fetch(`${BACKEND_URL}/api/v1/sessions/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log("Response status:", response.status);
      console.log(
        "Response headers:",
        Object.fromEntries(response.headers.entries())
      );

      if (response.ok) {
        startChargingSimulation(state, realtimeClient, channel);
        console.log("Charging session started successfully");
      } else {
        const text = await response.text().catch(() => "Unknown error");
        console.error(
          `Failed to start session with backend (status ${response.status}):` +
            text
        );
        state.isCharging = false; // Reset charging state on failure
      }
    } catch (error) {
      console.error("Failed to start session with backend:", error);
      state.isCharging = false; // Reset charging state on failure
    }
  });

  return { realtimeClient, channel };
}
