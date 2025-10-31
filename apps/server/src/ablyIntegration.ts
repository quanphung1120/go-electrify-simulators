import * as Ably from "ably";
import { SharedState } from "./state";
import { startChargingSimulation } from "./chargingSimulation";
import axios, { AxiosInstance } from "axios";

export const setupAblyIntegration = (state: SharedState) => {
  const BACKEND_URL = process.env.BACKEND_URL;
  const DOCK_ID = process.env.DOCK_ID;
  const SECRET = process.env.DOCK_SECRET;

  const realtimeClient = new Ably.Realtime({
    token: state.handshakeResponse?.data.ablyToken,
  });

  const channel = realtimeClient.channels.get(
    state.handshakeResponse!.channelId
  );

  const api: AxiosInstance = axios.create({
    baseURL: BACKEND_URL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
    },
  });

  channel.subscribe("session_specs", (message: any) => {
    console.log("Session specs received:", message.data);
  });

  setInterval(() => {
    channel.publish("dock_heartbeat", {
      timestamp: new Date().toISOString(),
    });
    console.log("Published dock heartbeat to Ably");
  }, 10000);

  channel.subscribe("load_car_information", (message: any) => {
    channel.publish("car_information", {
      currentCapacity: state.currentCapacity,
      maxCapacity: state.maxCapacity,
      timestamp: new Date().toISOString(),
    });
  });

  channel.subscribe("start_session", async (message: any) => {
    console.log("Start charging event received:", message.data);
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

    const targetSOCFromMessage = Number(message.data?.targetSOC);
    if (targetSOCFromMessage) {
      state.targetSOC = targetSOCFromMessage;
      console.log(`Target SOC set to: ${state.targetSOC}%`);
    }

    // Start charging simulation
    state.isCharging = true;
    console.log("Starting charging simulation...");

    // Notify backend that charging has started
    api
      .post("/api/v1/sessions/start", {
        Id: state.handshakeResponse!.data.sessionId,
        TargetSoc: state.targetSOC,
      })
      .then((response) => {
        if (response.status >= 200 || response.status < 300) {
          startChargingSimulation(state, realtimeClient, channel);
          console.log("Charging session started successfully");
        }
      });
  });

  return { realtimeClient, channel };
};
