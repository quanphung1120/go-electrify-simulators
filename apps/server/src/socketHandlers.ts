import { Server, Socket } from "socket.io";
import { SharedState, resetChargingState } from "./state";
import { handshakeResponse } from "./AblyCore";

export const setupSocketHandlers = (io: Server, state: SharedState): void => {
  io.on("connection", (socket: Socket) => {
    if (state.connectedClients >= 1) {
      console.log("Connection rejected: Another client is already connected");
      socket.emit("connection_rejected", {
        message: "Dock is already occupied by another vehicle",
        timestamp: new Date().toISOString(),
      });
      socket.disconnect();
      return;
    }

    state.connectedClients++;
    state.connectedSocket = socket;

    console.log(`Client connected. Total connected: ${state.connectedClients}`);
    console.log("A car connected:", socket.id);

    socket.on("configure_simulation", (config: any) => {
      console.log(
        `Received configuration: Current: ${config.batteryCapacity} kWh, Max: ${config.maxCapacity} kWh`
      );

      state.currentCapacity = config.batteryCapacity;
      state.maxCapacity = config.maxCapacity;

      socket.emit("handshake_success", {
        sessionId: handshakeResponse!.sessionId,
        channelId: handshakeResponse!.channelId,
        joinCode: handshakeResponse!.joinCode || "N/A",
        message:
          "Successfully connected to dock. Waiting for charging to start.",
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      state.connectedClients--;
      state.connectedSocket = null;

      console.log(
        `Client disconnected. Total connected: ${state.connectedClients}`
      );
      console.log("A car disconnected:", socket.id);

      // Stop charging if client disconnects
      resetChargingState(state);
    });
  });
};
