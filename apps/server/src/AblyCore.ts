import axios, { AxiosInstance } from "axios";
import { HandshakeResponse } from "./types";
import { STATUS_CODES } from "http";

export let handshakeResponse: HandshakeResponse | null = null;

export async function startDock() {
  const BACKEND_URL = process.env.BACKEND_URL;
  const DOCK_ID = process.env.DOCK_ID;
  const SECRET = process.env.DOCK_SECRET;
  const DOCK_JWT = process.env.DOCK_JWT;

  const api: AxiosInstance = axios.create({
    baseURL: BACKEND_URL,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
    },
  });

  const handshake = await api.post<{ data: HandshakeResponse }>(
    `/api/v1/docks/${DOCK_ID}/handshake`,
    { secretKey: SECRET }
  );

  if (handshake.status > 299) {
    throw new Error(
      `Dock handshake failed with status ${handshake.status}: ${
        STATUS_CODES[handshake.status] || "Unknown status"
      }`
    );
  }

  const payload = handshake.data.data;
  console.log("Dock handshake successful:", payload);
  handshakeResponse = payload;
}
