import { SharedState } from "./state";
import { DockLogRequest } from "./types";
import { SOCKET_EVENTS } from "@go-electrify/shared-types";
import { backendClient, formatAxiosError } from "./httpClient";
import { completeChargingSession } from "./sessionCompletion";

const LOG_INTERVAL_MS = 1000;
const POWER_INTERVAL_MS = 1000;

async function sendLogToBackend(logData: DockLogRequest): Promise<void> {
  try {
    await backendClient.post("/api/v1/docks/log", logData);
    console.log("Log sent to backend:", logData);
  } catch (error) {
    console.error("Failed to send log to backend:", formatAxiosError(error));
  }
}

export const startChargingSimulation = (
  state: SharedState,
  _realtimeClient: any,
  channel: any
): void => {
  // Session start time should already be set in chargingHandler before API call
  if (!state.sessionStartTime) {
    state.sessionStartTime = Date.now();
  }
  console.log(
    "Charging session started at:",
    new Date(state.sessionStartTime).toISOString()
  );

  const clearIntervals = (): void => {
    if (state.powerInterval) {
      clearInterval(state.powerInterval);
      state.powerInterval = null;
    }
    if (state.ablyPublishInterval) {
      clearInterval(state.ablyPublishInterval);
      state.ablyPublishInterval = null;
    }
  };

  const finalizeSession = async (
    reason: string,
    options?: { disconnectAfter?: boolean }
  ): Promise<void> => {
    try {
      await completeChargingSession(state, channel, reason);
      if (options?.disconnectAfter) {
        console.log("Completion message sent, disconnecting client...");
        state.connectedSocket?.disconnect();
      }
    } catch (error) {
      console.error("Error completing session:", error);
      if (options?.disconnectAfter) {
        state.connectedSocket?.disconnect();
      }
    }
  };

  const handleLogTick = (): void => {
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
      sessionEnergyKwh: Math.round(state.sessionChargedKwh * 100) / 100,
    };

    sendLogToBackend(logData);

    if (state.ablyChannel && state.ablyRealtimeClient) {
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
    }
  };

  const handlePowerTick = (): void => {
    if (!state.connectedSocket) {
      console.log("Socket disconnected during charging, completing session...");

      state.isCharging = false;
      clearIntervals();

      finalizeSession(
        `Charging interrupted! Vehicle disconnected at ${((state.currentCapacity / state.maxCapacity) * 100).toFixed(1)}% SOC`
      );
      return;
    }

    const maxChargerPowerKw = state.handshakeResponse?.data.charger?.powerKw;

    // Safety check for missing charger power
    if (!maxChargerPowerKw || maxChargerPowerKw <= 0) {
      console.error("Invalid charger power configuration");
      state.isCharging = false;
      clearIntervals();
      return;
    }

    const currentSOC = (state.currentCapacity / state.maxCapacity) * 100;

    let actualPowerKw = maxChargerPowerKw;
    if (currentSOC >= 95) {
      actualPowerKw = maxChargerPowerKw * 0.2;
    } else if (currentSOC >= 90) {
      actualPowerKw = maxChargerPowerKw * 0.4;
    } else if (currentSOC >= 80) {
      const taperingFactor = 1 - ((currentSOC - 80) / 10) * 0.3;
      actualPowerKw = maxChargerPowerKw * taperingFactor;
    }

    const intervalHours = 1 / 3600;
    const kwhConsumed = actualPowerKw * intervalHours;

    const previousCapacity = state.currentCapacity;
    state.currentCapacity = Math.min(
      state.maxCapacity,
      state.currentCapacity + kwhConsumed
    );

    const actualKwhDelivered = state.currentCapacity - previousCapacity;
    state.sessionChargedKwh += actualKwhDelivered;

    const newSOC = (state.currentCapacity / state.maxCapacity) * 100;

    state.connectedSocket.emit(SOCKET_EVENTS.POWER_UPDATE, {
      kwh: Math.round(actualKwhDelivered * 100) / 100,
      currentCapacity: Math.round(state.currentCapacity * 100) / 100,
      maxCapacity: Math.round(state.maxCapacity * 100) / 100,
      currentSOC: Math.round(newSOC * 100) / 100,
      chargingPowerKw: Math.round(actualPowerKw * 100) / 100,
      timestamp: new Date().toISOString(),
    });

    console.log(
      `Power update - SOC: ${newSOC.toFixed(1)}% | Capacity: ${state.currentCapacity.toFixed(3)} kWh | ` +
        `Power: ${actualPowerKw.toFixed(2)} kW | Energy added: ${(actualKwhDelivered * 1000).toFixed(2)} Wh`
    );

    if (currentSOC >= state.targetSOC) {
      console.log(`Target SOC ${state.targetSOC}% reached. Stopping charging.`);

      state.isCharging = false;
      clearIntervals();

      finalizeSession(
        `Charging complete! Reached target SOC of ${state.targetSOC}%`,
        { disconnectAfter: true }
      );
    }
  };

  state.ablyPublishInterval = setInterval(handleLogTick, LOG_INTERVAL_MS);
  state.powerInterval = setInterval(handlePowerTick, POWER_INTERVAL_MS);
};
