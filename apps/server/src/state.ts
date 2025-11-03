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
  completionInProgress: Promise<void> | null;
  sessionStartTime: number | null;
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
    completionInProgress: null,
    sessionStartTime: null,
  };
}

export function resetChargingState(state: SharedState): void {
  state.isCharging = false;
  state.sessionChargedKwh = 0;
  state.sessionStartTime = null;

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

export async function cleanupConnection(state: SharedState): Promise<void> {
  // Wait for any ongoing completion to finish before cleanup
  if (state.completionInProgress) {
    console.log("Waiting for charging completion to finish...");
    try {
      await state.completionInProgress;
      console.log("Charging completion finished, proceeding with cleanup");
    } catch (error) {
      console.error("Error during completion wait:", error);
    }
  }

  // Stop charging if active
  resetChargingState(state);

  // Cleanup Ably
  cleanupAblyConnection(state);

  if (state.connectedSocket) {
    try {
      state.connectedSocket.removeAllListeners();
    } catch (error) {
      console.error("Error removing socket listeners during cleanup:", error);
    }
    state.connectedSocket = null;
  }

  // Reset connection state
  state.currentCapacity = 0;
  state.maxCapacity = 0;
  state.targetSOC = 0;
  state.sessionChargedKwh = 0;
  state.sessionStartTime = null;
  state.isHandshakeComplete = false;
  state.handshakeResponse = null;
  state.completionInProgress = null;
}
