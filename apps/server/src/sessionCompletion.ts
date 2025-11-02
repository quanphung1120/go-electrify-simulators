import { SharedState, resetChargingState } from "./state";
import { DockLogRequest } from "./types";
import { SOCKET_EVENTS } from "@go-electrify/shared-types";
import { backendClient, formatAxiosError } from "./httpClient";

async function sendLogToBackend(logData: DockLogRequest): Promise<void> {
  try {
    await backendClient.post("/api/v1/docks/log", logData);
    console.log("Log sent to backend:", logData);
  } catch (error) {
    console.error("Failed to send log to backend:", formatAxiosError(error));
  }
}

export async function completeChargingSession(
  state: SharedState,
  channel: any,
  reason: string
): Promise<void> {
  console.log("Starting charging completion");

  const currentSOC = (state.currentCapacity / state.maxCapacity) * 100;

  // Calculate session duration in seconds
  const sessionDurationSeconds = state.sessionStartTime
    ? Math.floor((Date.now() - state.sessionStartTime) / 1000)
    : 0;

  await sendLogToBackend({
    dockId: parseInt(process.env.DOCK_ID || "0"),
    secretKey: process.env.DOCK_SECRET || "",
    sampleAt: new Date().toISOString(),
    socPercent: Math.round(currentSOC),
    state: "PARKING",
    sessionEnergyKwh: Math.round(state.sessionChargedKwh * 100) / 100,
  });

  // Emit charging complete to client (if still connected)
  if (state.connectedSocket) {
    state.connectedSocket.emit(SOCKET_EVENTS.CHARGING_COMPLETE, {
      message: reason,
      finalCapacity: Math.round(state.currentCapacity * 100) / 100,
      maxCapacity: Math.round(state.maxCapacity * 100) / 100,
      finalSOC: Math.round(currentSOC * 100) / 100,
      timestamp: new Date().toISOString(),
    });
  }

  // Publish charging complete message to Ably
  const completeMessage = {
    status: "completed",
    finalSOC: Math.round(currentSOC * 100) / 100,
    finalCapacity: Math.round(state.currentCapacity * 100) / 100,
    targetSOC: state.targetSOC,
    sessionChargedKwh: Math.round(state.sessionChargedKwh * 100) / 100,
    timestamp: new Date().toISOString(),
    sessionId: state.handshakeResponse!.data.sessionId,
  };

  try {
    await channel.publish("charging_complete", completeMessage);
    console.log(
      `Published charging completed to Ably: ${completeMessage.finalSOC}%`
    );
  } catch (error) {
    console.error("Failed to publish charging completion to Ably:", error);
  }

  try {
    console.log(
      `Session duration: ${sessionDurationSeconds} seconds (${(sessionDurationSeconds / 60).toFixed(2)} minutes)`
    );

    await backendClient.post(
      `/api/v1/sessions/${state.handshakeResponse!.data.sessionId}/complete`,
      {
        EnergyKwh: parseFloat(state.sessionChargedKwh.toFixed(2)),
        DurationSeconds: sessionDurationSeconds,
        EndSoc: Math.round(currentSOC),
        PricePerKwhOverride: state.handshakeResponse?.data.charger?.pricePerKwh,
      },
      {
        headers: {
          Authorization: `Bearer ${state.handshakeResponse?.data.dockJwt}`,
        },
      }
    );
    console.log("Session completed with backend successfully");
  } catch (error) {
    console.error(
      "Failed to complete session with backend:",
      formatAxiosError(error)
    );
  }

  resetChargingState(state);
  console.log("Charging completion finished");
}
