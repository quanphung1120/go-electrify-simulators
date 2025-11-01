import { Socket } from "socket.io";
import { HandshakeApiResponse } from "./types";

export interface SharedState {
  connectedClients: number;
  isCharging: boolean;
  connectedSocket: Socket | null;
  powerInterval: NodeJS.Timeout | null;
  ablyPublishInterval: NodeJS.Timeout | null;
  currentCapacity: number;
  maxCapacity: number;
  targetSOC: number;
  handshakeResponse: HandshakeApiResponse | null;
  sessionChargedKwh: number;
}

export function createSharedState(): SharedState {
  return {
    connectedClients: 0,
    isCharging: false,
    connectedSocket: null,
    powerInterval: null,
    ablyPublishInterval: null,
    currentCapacity: 0,
    maxCapacity: 0,
    targetSOC: 0,
    handshakeResponse: null,
    sessionChargedKwh: 0,
  };
}

export function resetChargingState(state: SharedState): void {
  state.isCharging = false;
  state.sessionChargedKwh = 0;
  if (state.powerInterval) {
    clearInterval(state.powerInterval);
    state.powerInterval = null;
  }
  if (state.ablyPublishInterval) {
    clearInterval(state.ablyPublishInterval);
    state.ablyPublishInterval = null;
  }
}
