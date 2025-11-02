import { HandshakeApiResponse, PingResponse } from "./types";
import { STATUS_CODES } from "http";
import { SharedState } from "./state";
import {
  backendClient,
  formatAxiosError,
  getAxiosErrorStatus,
} from "./httpClient";

/**
 * Perform handshake with backend to get session credentials
 * Should be called when a car connects, not on server startup
 */
export async function performHandshake(state: SharedState): Promise<void> {
  const DOCK_ID = process.env.DOCK_ID;
  const SECRET = process.env.DOCK_SECRET;

  // Validate environment variables
  if (!DOCK_ID) {
    throw new Error("DOCK_ID environment variable is not set");
  }

  if (!SECRET) {
    throw new Error("DOCK_SECRET environment variable is not set");
  }

  try {
    console.log("Performing dock handshake with backend...");

    const response = await backendClient.post(
      `/api/v1/docks/${DOCK_ID}/handshake`,
      { SecretKey: SECRET },
      {
        headers: {
          Authorization: `Bearer ${SECRET}`,
        },
      }
    );

    // Validate and transform the API response
    // Note: The API returns a nested structure with status, ok, and data fields
    // We'll validate just the data part since that's what we need
    const handshakeData: HandshakeApiResponse = response.data;

    state.handshakeResponse = handshakeData;
    state.isHandshakeComplete = true;
    console.log("Dock handshake successful:", handshakeData);
  } catch (error) {
    console.error("Dock handshake failed:", formatAxiosError(error));

    const status = getAxiosErrorStatus(error);
    if (status) {
      throw new Error(
        `Dock handshake failed with status ${status}: ${
          STATUS_CODES[status] || "Unknown status"
        }`
      );
    }

    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Start ping interval to keep dock connection alive with backend
 * Should be called after successful handshake
 */
export function startPingInterval(state: SharedState): void {
  const DOCK_ID = process.env.DOCK_ID;
  const SECRET = process.env.DOCK_SECRET;

  // Validate environment variables
  if (!DOCK_ID || !SECRET) {
    console.error("Cannot start ping interval: DOCK_ID or DOCK_SECRET not set");
    return;
  }

  // Clear existing ping interval if any
  if (state.pingInterval) {
    clearInterval(state.pingInterval);
  }

  state.pingInterval = setInterval(async () => {
    try {
      const pingResponse = await backendClient.post<PingResponse>(
        "/api/v1/docks/ping",
        {
          DockId: DOCK_ID,
          SecretKey: SECRET,
        }
      );

      console.log(
        "Ping successful. Server time:",
        pingResponse.data.serverTime
      );
    } catch (error) {
      console.error("Ping request failed:", formatAxiosError(error));
    }
  }, 10000);

  console.log("Ping interval started");
}
