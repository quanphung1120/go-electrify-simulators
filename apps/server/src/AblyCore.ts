import { HandshakeApiResponse, PingResponse } from "./types";
import { STATUS_CODES } from "http";
import { SharedState } from "./state";

export async function startDock(state: SharedState) {
  const BACKEND_URL = process.env.BACKEND_URL;
  const DOCK_ID = process.env.DOCK_ID;
  const SECRET = process.env.DOCK_SECRET;

  try {
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

    const handshakeData: HandshakeApiResponse = await handshakeResponse.json();
    state.handshakeResponse = handshakeData;
    console.log("Dock handshake successful:", handshakeData);

    setInterval(async () => {
      try {
        const pingResponse = await fetch(`${BACKEND_URL}/api/v1/docks/ping`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SECRET}`,
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
    }, 5000);
  } catch (error) {
    console.error("Dock initialization failed:", error);
    throw error;
  }
}
