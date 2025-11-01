import { SharedState, resetChargingState } from "./state";
import { DockLogRequest } from "./types";
import { SOCKET_EVENTS, ABLY_EVENTS } from "@go-electrify/shared-types";

async function sendLogToBackend(logData: DockLogRequest): Promise<void> {
  try {
    const BACKEND_URL = process.env.BACKEND_URL;
    const response = await fetch(`${BACKEND_URL}/api/v1/docks/log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(logData),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(
        `Failed to send log to backend (status ${response.status}):`,
        errorText
      );
    } else {
      console.log("Log sent to backend:", logData);
    }
  } catch (error) {
    console.error("Failed to send log to backend:", error);
  }
}

async function completeChargingSession(
  state: SharedState,
  backendUrl: string,
  channel: any,
  status: "completed" | "interrupted",
  reason: string
): Promise<void> {
  const currentSOC = (state.currentCapacity / state.maxCapacity) * 100;

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

  // Emit charging complete to client (if still connected)
  if (state.connectedSocket) {
    state.connectedSocket.emit(SOCKET_EVENTS.CHARGING_COMPLETE, {
      message: reason,
      finalCapacity: state.currentCapacity,
      maxCapacity: state.maxCapacity,
      finalSOC: currentSOC,
      timestamp: new Date().toISOString(),
    });
  }

  // Publish charging complete message to Ably
  const completeMessage = {
    status,
    finalSOC: Math.round(currentSOC * 100) / 100,
    finalCapacity: state.currentCapacity,
    targetSOC: state.targetSOC,
    sessionChargedKwh: state.sessionChargedKwh,
    timestamp: new Date().toISOString(),
    sessionId: state.handshakeResponse!.data.sessionId,
  };

  // Complete session with backend
  try {
    const response = await fetch(`${backendUrl}/api/v1/sessions/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DOCK_SECRET}`,
      },
      body: JSON.stringify({
        EnergyKwh: state.sessionChargedKwh,
        DurationSeconds: 60,
        EndSoc: Math.round(currentSOC),
        PricePerKwhOverride: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(
        `Failed to complete session with backend (status ${response.status}):`,
        errorText
      );
    }
  } catch (error) {
    console.error("Failed to complete session with backend:", error);
  }

  // Publish to Ably (only if connection still active)
  if (state.ablyChannel && state.ablyRealtimeClient) {
    try {
      channel.publish(ABLY_EVENTS.CHARGING_EVENT, completeMessage);
      console.log(
        `Published charging ${status} to Ably: ${completeMessage.finalSOC}%`
      );
    } catch (error) {
      console.error(`Failed to publish charging ${status} to Ably:`, error);
    }
  } else {
    console.log("Ably connection closed, skipping charging_complete publish");
  }

  resetChargingState(state);
}

export function startChargingSimulation(
  state: SharedState,
  realtimeClient: any,
  channel: any
): void {
  // Start logging interval (every 1 second)

  const BACKEND_URL = process.env.BACKEND_URL || "";

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

    // Only publish to Ably if connection is still active
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
  }, 1000);

  state.powerInterval = setInterval(() => {
    if (!state.connectedSocket) {
      console.log("Socket disconnected during charging, completing session...");
      completeChargingSession(
        state,
        BACKEND_URL,
        channel,
        "interrupted",
        `Charging interrupted! Vehicle disconnected at ${((state.currentCapacity / state.maxCapacity) * 100).toFixed(1)}% SOC`
      ).catch((error) =>
        console.error("Error completing interrupted session:", error)
      );
      return;
    }

    const powerConsumptionPerSecond =
      state.handshakeResponse?.data.charger?.powerKw!;
    const kwhConsumed = powerConsumptionPerSecond * 5; // 5 seconds interval
    state.currentCapacity = Math.min(
      state.maxCapacity,
      state.currentCapacity + kwhConsumed
    );
    state.sessionChargedKwh += kwhConsumed;

    const currentSOC = (state.currentCapacity / state.maxCapacity) * 100;
    state.connectedSocket.emit(SOCKET_EVENTS.POWER_UPDATE, {
      kwh: kwhConsumed,
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

      completeChargingSession(
        state,
        BACKEND_URL,
        channel,
        "completed",
        `Charging complete! Reached target SOC of ${state.targetSOC}%`
      ).catch((error) => console.error("Error completing session:", error));

      setTimeout(() => {
        state.connectedSocket?.disconnect();
      }, 2000);
    }
  }, 1000);
}
