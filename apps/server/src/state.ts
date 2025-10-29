import { Socket } from "socket.io";

export interface SharedState {
  connectedClients: number;
  isCharging: boolean;
  connectedSocket: Socket | null;
  powerInterval: NodeJS.Timeout | null;
  ablyPublishInterval: NodeJS.Timeout | null;
  currentCapacity: number;
  maxCapacity: number;
  targetSOC: number;
}

export const createSharedState = (): SharedState => ({
  connectedClients: 0,
  isCharging: false,
  connectedSocket: null,
  powerInterval: null,
  ablyPublishInterval: null,
  currentCapacity: 0,
  maxCapacity: 0,
  targetSOC: 0,
});

export const resetChargingState = (state: SharedState): void => {
  state.isCharging = false;
  if (state.powerInterval) {
    clearInterval(state.powerInterval);
    state.powerInterval = null;
  }
  if (state.ablyPublishInterval) {
    clearInterval(state.ablyPublishInterval);
    state.ablyPublishInterval = null;
  }
};
