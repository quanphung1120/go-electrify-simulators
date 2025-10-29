import { Socket } from "socket.io";
import { SharedState } from "./state";
import { handshakeResponse } from "./AblyCore";

export const startChargingSimulation = (
  state: SharedState,
  realtimeClient: any,
  channel: any
): void => {
  // Start Ably publishing interval (every 4 seconds)
  state.ablyPublishInterval = setInterval(() => {
    if (!state.connectedSocket || !state.isCharging) {
      return;
    }

    const currentSOC = (state.currentCapacity / state.maxCapacity) * 100;
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
  }, 4000);

  state.powerInterval = setInterval(() => {
    if (!state.connectedSocket) {
      console.log("Socket disconnected during charging, stopping...");
      resetChargingState(state);
      return;
    }

    const powerConsumptionPerSecond = 1; // 1 kW per second
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
        sessionId: handshakeResponse!.sessionId,
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
      }, 1000);
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
