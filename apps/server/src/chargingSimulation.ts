import { Socket } from "socket.io";
import { SharedState } from "./state";
import axios from "axios";
import { DockLogRequest } from "./types";

const sendLogToBackend = async (logData: DockLogRequest) => {
  try {
    const BACKEND_URL = process.env.BACKEND_URL;
    await axios.post(`${BACKEND_URL}/api/v1/docks/log`, logData);
    console.log("Log sent to backend:", logData);
  } catch (error) {
    console.error("Failed to send log to backend:", error);
  }
};

export const startChargingSimulation = (
  state: SharedState,
  realtimeClient: any,
  channel: any
): void => {
  // Start logging interval (every 1 second)
  state.ablyPublishInterval = setInterval(() => {
    if (!state.isCharging) {
      return;
    }

    const currentSOC = (state.currentCapacity / state.maxCapacity) * 100;
    const logData: DockLogRequest = {
      dockId: parseInt(process.env.DOCK_ID || "0"),
      secretKey: process.env.DOCK_SECRET || "",
      sampleAt: new Date().toISOString(),
      socPercent: Math.round(currentSOC),
      state: "CHARGING",
      sessionEnergyKwh: state.currentCapacity,
    };

    sendLogToBackend(logData);

    try {
      channel.publish("soc_update", {
        soc: Math.round(currentSOC * 100) / 100,
        timestamp: new Date().toISOString(),
      });
      console.log(
        `Published SOC update to Ably: ${Math.round(currentSOC * 100) / 100}%`
      );
    } catch (error) {
      console.error("Failed to publish SOC update to Ably:", error);
    }
  }, 1000);

  state.powerInterval = setInterval(() => {
    if (!state.connectedSocket) {
      console.log("Socket disconnected during charging, stopping...");
      resetChargingState(state);
      return;
    }

    const powerConsumptionPerSecond =
      state.handshakeResponse?.data.charger?.powerKw!; // 1 kW per second
    state.currentCapacity = Math.min(
      state.maxCapacity,
      state.currentCapacity + powerConsumptionPerSecond * 5 // 5 seconds interval
    );

    const currentSOC = (state.currentCapacity / state.maxCapacity) * 100;
    state.connectedSocket.emit("power_update", {
      kwh: powerConsumptionPerSecond * 5,
      currentCapacity: state.currentCapacity,
      maxCapacity: state.maxCapacity,
      currentSOC: currentSOC,
      timestamp: new Date().toISOString(),
    });

    console.log(
      `Power update sent - Current capacity: ${state.currentCapacity} kWh (${currentSOC.toFixed(1)}%)`
    );

    if (currentSOC >= state.targetSOC) {
      console.log(`Target SOC ${state.targetSOC}% reached. Stopping charging.`);

      // Send final log to backend
      const finalLogData: DockLogRequest = {
        dockId: parseInt(process.env.DOCK_ID || "0"),
        secretKey: process.env.DOCK_SECRET || "",
        sampleAt: new Date().toISOString(),
        socPercent: Math.round(currentSOC),
        state: "PARKING",
        sessionEnergyKwh: state.currentCapacity,
      };

      sendLogToBackend(finalLogData);
      state.connectedSocket.emit("charging_complete", {
        message: `Charging complete! Reached target SOC of ${state.targetSOC}%`,
        finalCapacity: state.currentCapacity,
        finalSOC: currentSOC,
        timestamp: new Date().toISOString(),
      });

      // Publish charging complete message to Ably
      const completeMessage = {
        status: "completed",
        finalSOC: Math.round(currentSOC * 100) / 100,
        finalCapacity: state.currentCapacity,
        targetSOC: state.targetSOC,
        timestamp: new Date().toISOString(),
        sessionId: state.handshakeResponse!.data.sessionId,
      };

      try {
        channel.publish("charging_complete", completeMessage);
        console.log(
          `Published charging complete to Ably: ${completeMessage.finalSOC}%`
        );
      } catch (error) {
        console.error("Failed to publish charging complete to Ably:", error);
      }

      resetChargingState(state);

      // Disconnect client after a short delay
      setTimeout(() => {
        state.connectedSocket?.disconnect();
      }, 2000);
    }
  }, 1000);
};

const resetChargingState = (state: SharedState): void => {
  state.isCharging = false;
  if (state.powerInterval) {
    clearInterval(state.powerInterval);
    state.powerInterval = null;
  }
  if (state.ablyPublishInterval) {
    clearInterval(state.ablyPublishInterval);
    state.ablyPublishInterval = null;
  }
};
