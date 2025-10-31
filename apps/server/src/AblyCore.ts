import axios, { AxiosInstance } from "axios";
import { HandshakeResponse, HandshakeApiResponse, PingResponse } from "./types";
import { STATUS_CODES } from "http";
import { SharedState } from "./state";

export async function startDock(state: SharedState) {
  const BACKEND_URL = process.env.BACKEND_URL;
  const DOCK_ID = process.env.DOCK_ID;
  const SECRET = process.env.DOCK_SECRET;

  const api: AxiosInstance = axios.create({
    baseURL: BACKEND_URL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
    },
  });

  const handshake = await api.post<HandshakeApiResponse>(
    `/api/v1/docks/${DOCK_ID}/handshake`,
    { SecretKey: SECRET }
  );

  if (handshake.status > 299) {
    throw new Error(
      `Dock handshake failed with status ${handshake.status}: ${
        STATUS_CODES[handshake.status] || "Unknown status"
      }`
    );
  }

  state.handshakeResponse = handshake.data;
  console.log("Dock handshake successful:", state.handshakeResponse);

  setInterval(async () => {
    const ping = await api.post<PingResponse>(`/api/v1/docks/ping`, {
      DockId: DOCK_ID,
      SecretKey: SECRET,
    });

    if (ping.status >= 200 && ping.status < 300) {
      console.log("Ping successful. Server time:", ping.data.serverTime);
    }
  }, 5000);
}
