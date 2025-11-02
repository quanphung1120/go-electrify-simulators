import { Server, Socket } from "socket.io";
import { SharedState, cleanupConnection } from "../state";
import { performHandshake } from "../ablyCore";
import { setupAblyIntegration } from "../ablyIntegration";
import { SOCKET_EVENTS } from "@go-electrify/shared-types";
import { completeChargingSession } from "../sessionCompletion";

export const registerConnectionHandlers = async (
  io: Server,
  socket: Socket,
  state: SharedState
): Promise<void> => {
  // Check if dock is already occupied
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
      socket.disconnect(true);
      await cleanupConnection(state);
      state.connectedClients = Math.max(0, state.connectedClients - 1);
      return;
    }
  }

  // Register disconnect handler
  const handleDisconnect = async (): Promise<void> => {
    console.log("A car disconnected:", socket.id);

    // If charging is active, trigger completion before cleanup
    if (state.isCharging && !state.completionInProgress) {
      console.log(
        "Car disconnected during charging - triggering session completion..."
      );

      // Calculate SOC before stopping charging
      const currentSOC = (state.currentCapacity / state.maxCapacity) * 100;

      // Mark as not charging (intervals will be cleared in resetChargingState)
      state.isCharging = false;

      await completeChargingSession(
        state,
        state.ablyChannel,
        `Charging interrupted! Vehicle disconnected at ${currentSOC.toFixed(1)}% SOC`
      );
    }

    // Wait for any ongoing completion to finish before cleanup
    await cleanupConnection(state);

    // Reset connection tracking
    state.connectedClients = Math.max(0, state.connectedClients - 1);

    console.log(
      `Client disconnected. Total connected: ${state.connectedClients}`
    );
    console.log("Cleanup completed. Ready for next connection.");
  };

  socket.on("disconnect", handleDisconnect);
};
