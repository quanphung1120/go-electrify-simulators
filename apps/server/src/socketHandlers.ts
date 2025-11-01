import { Server, Socket } from "socket.io";
import { SharedState, cleanupConnection } from "./state";
import { performHandshake, startPingInterval } from "./AblyCore";
import { setupAblyIntegration } from "./ablyIntegration";
import { SOCKET_EVENTS } from "@go-electrify/shared-types";
import type { CarConfigMessage } from "@go-electrify/shared-types";

export function setupSocketHandlers(io: Server, state: SharedState): void {
  io.on("connection", async (socket: Socket) => {
    if (state.connectedClients >= 1) {
      console.log("Connection rejected: Another client is already connected");
      socket.emit(SOCKET_EVENTS.CONNECTION_REJECTED, {
        reason: "Dock is already occupied by another vehicle",
        timestamp: new Date().toISOString(),
      });
      socket.disconnect();
      return;
    }

    state.connectedClients++;
    state.connectedSocket = socket;

    console.log(`Client connected. Total connected: ${state.connectedClients}`);
    console.log("A car connected:", socket.id);

    // Perform handshake with backend when car connects
    if (!state.isHandshakeComplete) {
      try {
        console.log("Car connected - initiating handshake with backend...");
        await performHandshake(state);

        // Start ping interval after successful handshake
        startPingInterval(state);

        // Setup Ably integration
        setupAblyIntegration(state);

        console.log("Handshake and Ably setup completed successfully");

        // Emit initial handshake success with joinCode immediately
        socket.emit(SOCKET_EVENTS.HANDSHAKE_SUCCESS, {
          sessionId: state.handshakeResponse!.data.sessionId,
          channelId: state.handshakeResponse!.channelId,
          joinCode: state.handshakeResponse!.data.joinCode || "N/A",
          message:
            "Successfully connected to dock. Please configure your vehicle.",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Failed to perform handshake:", error);
        socket.emit(SOCKET_EVENTS.CONNECTION_REJECTED, {
          reason: "Failed to initialize dock session with backend",
          timestamp: new Date().toISOString(),
        });
        socket.disconnect();
        state.connectedClients--;
        state.connectedSocket = null;
        return;
      }
    }

    socket.on(SOCKET_EVENTS.CAR_CONFIGURE, (data: CarConfigMessage) => {
      console.log(
        `Received configuration: Current: ${data.batteryCapacity} kWh, Max: ${data.maxCapacity} kWh`
      );

      state.currentCapacity = data.batteryCapacity;
      state.maxCapacity = data.maxCapacity;

      // Update message after configuration
      socket.emit(SOCKET_EVENTS.CONFIGURATION_COMPLETE, {
        message: "Vehicle configured. Waiting for charging to start.",
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      console.log("A car disconnected:", socket.id);

      // Cleanup all resources before decrementing counter
      cleanupConnection(state);

      // Reset connection tracking
      state.connectedClients--;
      state.connectedSocket = null;

      console.log(
        `Client disconnected. Total connected: ${state.connectedClients}`
      );
      console.log("Cleanup completed. Ready for next connection.");
    });
  });
}
