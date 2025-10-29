import * as Ably from "ably";
import { handshakeResponse } from "./AblyCore";
import { SharedState } from "./state";
import { startChargingSimulation } from "./chargingSimulation";

export const setupAblyIntegration = (state: SharedState) => {
  const realtimeClient = new Ably.Realtime({
    token: handshakeResponse!.ablyToken,
  });

  const channel = realtimeClient.channels.get(handshakeResponse!.channelId);

  channel.subscribe("session_specs", (message: any) => {
    console.log("Session specs received:", message.data);
  });

  channel.subscribe("load_car_information", (message: any) => {
    channel.publish("car_information", {
      currentCapacity: state.currentCapacity,
      maxCapacity: state.maxCapacity,
      timestamp: new Date().toISOString(),
    });
  });

  channel.subscribe("start_session", (message: any) => {
    console.log("Start charging event received:", message.data);

    // Extract target SOC from Ably message
    const targetSOCFromMessage = message.data?.targetSOC;
    if (targetSOCFromMessage) {
      state.targetSOC = targetSOCFromMessage;
      console.log(`Target SOC set to: ${state.targetSOC}%`);
    }

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

    // Start charging simulation
    state.isCharging = true;
    console.log("Starting charging simulation...");

    startChargingSimulation(state, realtimeClient, channel);
  });

  return { realtimeClient, channel };
};
