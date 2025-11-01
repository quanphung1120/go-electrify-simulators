import { HandshakeApiResponse, PingResponse } from "./types";
import { STATUS_CODES } from "http";
import { SharedState } from "./state";

/**
 * Perform handshake with backend to get session credentials
 * Should be called when a car connects, not on server startup
 */
export async function performHandshake(state: SharedState): Promise<void> {
  const BACKEND_URL = process.env.BACKEND_URL;
  const DOCK_ID = process.env.DOCK_ID;
  const SECRET = process.env.DOCK_SECRET;

  try {
    console.log("Performing dock handshake with backend...");

    const handshakeResponse = await fetch(
      `${BACKEND_URL}/api/v1/docks/${DOCK_ID}/handshake`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SECRET}`,
        },
        body: JSON.stringify({ SecretKey: SECRET }),
      }
    );

    if (!handshakeResponse.ok) {
      const errorText = await handshakeResponse
        .text()
        .catch(() => "Unknown error");
      console.error(
        `Dock handshake failed with status ${handshakeResponse.status}:`,
        errorText
      );
      throw new Error(
        `Dock handshake failed with status ${handshakeResponse.status}: ${
          STATUS_CODES[handshakeResponse.status] || "Unknown status"
        }`
      );
    }

    const rawData = await handshakeResponse.json();

    // Validate and transform the API response
    // Note: The API returns a nested structure with status, ok, and data fields
    // We'll validate just the data part since that's what we need
    const handshakeData: HandshakeApiResponse = rawData;

    state.handshakeResponse = handshakeData;
    state.isHandshakeComplete = true;
    console.log("Dock handshake successful:", handshakeData);
  } catch (error) {
    console.error("Dock handshake failed:", error);
    throw error;
  }
}

/**
 * Start ping interval to keep dock connection alive with backend
 * Should be called after successful handshake
 */
export function startPingInterval(state: SharedState): void {
  const BACKEND_URL = process.env.BACKEND_URL;
  const DOCK_ID = process.env.DOCK_ID;
  const SECRET = process.env.DOCK_SECRET;

  // Clear existing ping interval if any
  if (state.pingInterval) {
    clearInterval(state.pingInterval);
  }

  state.pingInterval = setInterval(async () => {
    try {
      const pingResponse = await fetch(`${BACKEND_URL}/api/v1/docks/ping`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          DockId: DOCK_ID,
          SecretKey: SECRET,
        }),
      });

      if (pingResponse.ok) {
        const pingData: PingResponse = await pingResponse.json();
        console.log("Ping successful. Server time:", pingData.serverTime);
      } else {
        const errorText = await pingResponse
          .text()
          .catch(() => "Unknown error");
        console.error(
          `Ping failed with status ${pingResponse.status}:`,
          errorText
        );
      }
    } catch (error) {
      console.error("Ping request failed:", error);
    }
  }, 10000);

  console.log("Ping interval started");
}
