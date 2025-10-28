export interface SimulationConfig {
  batteryCapacity: number;
  maxCapacity: number;
  targetSOC: number;
  timestamp: string;
}

export interface StartChargingData {
  target_soc: number;
}

export interface PowerUpdateData {
  kwh: number;
  currentCapacity: number;
  maxCapacity: number;
  currentSOC: number;
  timestamp: string;
}

export interface ChargingCompleteData {
  message: string;
  finalCapacity: number;
  finalSOC: number;
  timestamp: string;
}

export interface HandshakeSuccessData {
  message: string;
  ablyChannel: string;
  timestamp: string;
}

export interface ConnectionRejectedData {
  message: string;
  timestamp: string;
}

export interface SessionSpecs {
  sessionId: number;
  vehicle: {
    batteryCapacityKwh: number;
    maxPowerKw: number;
  };
  charger: {
    powerKw: number;
  };
  initialSoc?: number;
  targetSoc: number;
}

export interface HandshakeResponse {
  sessionId: number;
  channelId: string;
  dockJwt: string;
  ablyToken?: string;
  joinCode?: string;
}

export interface StopSessionDto {
  reason: string;
  finalSoc?: number;
  energyKwh?: number;
}

export interface StartSessionPayload {
  TargetSOC?: number;
  target_soc?: number;
  initialSOC?: number;
  InitialSOC?: number;
}

export interface DockLogRequest {
  dockId: number;
  secretKey: string;
  sampleAt: string;
  socPercent: number;
  state: "CHARGING" | "PARKING";
  powerKw?: number;
  voltage?: number;
  current?: number;
  sessionEnergyKwh?: number;
}
