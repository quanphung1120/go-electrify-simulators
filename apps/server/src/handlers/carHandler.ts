import { Server, Socket } from "socket.io";
import { SharedState } from "../state";
import { SOCKET_EVENTS } from "@go-electrify/shared-types";
import type { CarConfigMessage } from "@go-electrify/shared-types";

export const registerCarHandlers = (
  io: Server,
  socket: Socket,
  state: SharedState
): void => {
  const handleCarConfigure = (data: CarConfigMessage): void => {
    console.log(
      `Received configuration: Current: ${data.batteryCapacity} kWh, Max: ${data.maxCapacity} kWh`
    );

    // Validate battery configuration
    if (data.maxCapacity <= 0) {
      console.error("Invalid maxCapacity: must be greater than 0");
      socket.emit(SOCKET_EVENTS.VALIDATION_ERROR, {
        event: "car_configure",
        error: "maxCapacity must be greater than 0",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (data.batteryCapacity < 0) {
      console.error("Invalid batteryCapacity: cannot be negative");
      socket.emit(SOCKET_EVENTS.VALIDATION_ERROR, {
        event: "car_configure",
        error: "batteryCapacity cannot be negative",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (data.batteryCapacity > data.maxCapacity) {
      console.error("Invalid configuration: batteryCapacity > maxCapacity");
      socket.emit(SOCKET_EVENTS.VALIDATION_ERROR, {
        event: "car_configure",
        error: "batteryCapacity cannot exceed maxCapacity",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    state.currentCapacity = data.batteryCapacity;
    state.maxCapacity = data.maxCapacity;

    // Update message after configuration
    socket.emit(SOCKET_EVENTS.CONFIGURATION_COMPLETE, {
      message: "Vehicle configured. Waiting for charging to start.",
      timestamp: new Date().toISOString(),
    });
  };

  socket.on(SOCKET_EVENTS.CAR_CONFIGURE, handleCarConfigure);
};
