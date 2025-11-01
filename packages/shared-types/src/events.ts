export const SOCKET_EVENTS = {
  CAR_CONFIGURE: "car_configure",
  HANDSHAKE_SUCCESS: "handshake_success",
  POWER_UPDATE: "power_update",
  CHARGING_COMPLETE: "charging_complete",
  CONNECTION_REJECTED: "connection_rejected",
  VALIDATION_ERROR: "validation_error",
  CONFIGURATION_COMPLETE: "configuration_complete",
} as const;

export const ABLY_EVENTS = {
  SESSION_SPECS: "session_specs",
  LOAD_CAR_INFO: "load_car_information",
  START_SESSION: "start_session",
  DOCK_HEARTBEAT: "dock_heartbeat",
  CAR_INFO: "car_information",
  CHARGING_EVENT: "charging_event",
} as const;

export type SocketEventName =
  (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
export type AblyEventName = (typeof ABLY_EVENTS)[keyof typeof ABLY_EVENTS];
