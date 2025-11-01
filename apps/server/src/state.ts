import { Socket } from "socket.io";
import { HandshakeApiResponse } from "./types";

export interface SharedState {
  connectedClients: number;
  isCharging: boolean;
  connectedSocket: Socket | null;
  powerInterval: NodeJS.Timeout | null;
  ablyPublishInterval: NodeJS.Timeout | null;
  pingInterval: NodeJS.Timeout | null;
  heartbeatInterval: NodeJS.Timeout | null;
  currentCapacity: number;
  maxCapacity: number;
  targetSOC: number;
  handshakeResponse: HandshakeApiResponse | null;
  sessionChargedKwh: number;
  isHandshakeComplete: boolean;
  ablyRealtimeClient: any | null;
  ablyChannel: any | null;
}

export function createSharedState(): SharedState {
  return {
    connectedClients: 0,
    isCharging: false,
    connectedSocket: null,
    powerInterval: null,
    ablyPublishInterval: null,
    pingInterval: null,
    heartbeatInterval: null,
    currentCapacity: 0,
    maxCapacity: 0,
    targetSOC: 0,
    handshakeResponse: null,
    sessionChargedKwh: 0,
    isHandshakeComplete: false,
    ablyRealtimeClient: null,
    ablyChannel: null,
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

export function cleanupAblyConnection(state: SharedState): void {
  // Clear heartbeat interval
  if (state.heartbeatInterval) {
    clearInterval(state.heartbeatInterval);
    state.heartbeatInterval = null;
    console.log("Heartbeat interval stopped");
  }

  // Close Ably connection
  if (state.ablyRealtimeClient) {
    try {
      state.ablyRealtimeClient.close();
      console.log("Ably connection closed");
    } catch (error) {
      console.error("Error closing Ably connection:", error);
    }
    state.ablyRealtimeClient = null;
    state.ablyChannel = null;
  }
}

export function cleanupConnection(state: SharedState): void {
  // Stop charging if active
  resetChargingState(state);

  // Cleanup Ably
  cleanupAblyConnection(state);

  // Stop ping interval
  if (state.pingInterval) {
    clearInterval(state.pingInterval);
    state.pingInterval = null;
    console.log("Ping interval stopped");
  }

  // Reset connection state
  state.currentCapacity = 0;
  state.maxCapacity = 0;
  state.targetSOC = 0;
  state.isHandshakeComplete = false;
  state.handshakeResponse = null;
}
