import { SharedState } from "../state";
import { startChargingSimulation } from "../chargingSimulation";
import { ABLY_EVENTS } from "@go-electrify/shared-types";
import type { StartSessionMessage } from "@go-electrify/shared-types";
import { backendClient, formatAxiosError } from "../httpClient";

export const registerChargingHandler = (
  realtimeClient: any,
  channel: any,
  state: SharedState
): void => {
  const handleStartSession = async (message: any): Promise<void> => {
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

    // Validate and set target SOC
    if (sessionData.targetSOC) {
      if (sessionData.targetSOC < 0 || sessionData.targetSOC > 100) {
        console.error(
          `Invalid targetSOC: ${sessionData.targetSOC}. Must be between 0-100`
        );
        return;
      }

      const currentSOC = (state.currentCapacity / state.maxCapacity) * 100;
      if (sessionData.targetSOC <= currentSOC) {
        console.error(
          `Invalid targetSOC: ${sessionData.targetSOC}% is not greater than current SOC ${currentSOC.toFixed(1)}%`
        );
        return;
      }

      state.targetSOC = sessionData.targetSOC;
      console.log(`Target SOC set to: ${state.targetSOC}%`);
    } else {
      // Default to 100% if not specified
      state.targetSOC = 100;
      console.log(`Target SOC not specified, defaulting to 100%`);
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

      const response = await backendClient.post(
        "/api/v1/sessions/start",
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${jwtToken}`,
          },
        }
      );

      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);

      // Reset session energy counter before starting
      state.sessionChargedKwh = 0;
      state.sessionStartTime = Date.now();

      startChargingSimulation(state, realtimeClient, channel);
      console.log("Charging session started successfully");
    } catch (error) {
      console.error(
        "Failed to start session with backend:",
        formatAxiosError(error)
      );
      state.isCharging = false; // Reset charging state on failure
    }
  };

  channel.subscribe(ABLY_EVENTS.START_SESSION, handleStartSession);
};
