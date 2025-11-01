// Socket.IO Message Types
export interface CarConfigMessage {
  batteryCapacity: number;
  maxCapacity: number;
  timestamp: string;
}

export interface HandshakeSuccessMessage {
  sessionId: number;
  channelId: string;
  joinCode: string;
  message: string;
  timestamp: string;
}

export interface PowerUpdateMessage {
  kwh: number;
  currentCapacity: number;
  maxCapacity: number;
  currentSOC: number;
  timestamp: string;
}

export interface ChargingCompleteMessage {
  message: string;
  finalCapacity: number;
  maxCapacity: number;
  finalSOC: number;
  timestamp: string;
}

export interface ConnectionRejectedMessage {
  reason: string;
  timestamp: string;
}

export interface ValidationErrorMessage {
  event: string;
  error: string;
  timestamp: string;
}

export interface ConfigurationCompleteMessage {
  message: string;
  timestamp: string;
}

// Ably Message Types
export interface StartSessionMessage {
  targetSOC?: number;
}

export interface SessionSpecsMessage {
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
