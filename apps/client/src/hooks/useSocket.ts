import { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// Event data types
export interface PowerUpdateData {
  kwh: number;
  currentCapacity: number;
  maxCapacity: number;
  currentSOC: number;
  timestamp: string;
}

export interface HandshakeSuccessData {
  sessionId: number;
  channelId: string;
  joinCode: string;
  message: string;
  timestamp: string;
}

export interface ConnectionRejectedData {
  message: string;
  timestamp: string;
}

export interface ChargingCompleteData {
  message: string;
  finalCapacity: number;
  finalSOC: number;
  timestamp: string;
}

export interface SimulationConfig {
  batteryCapacity: number;
  maxCapacity: number;
  targetSOC: number;
  socketUrl: string;
}

export interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  messages: string[];
  connect: (config: SimulationConfig) => void;
  disconnect: () => void;
  clearMessages: () => void;
}

export function useSocket(setValue?: (field: string, value: any) => void): UseSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);

  const addMessage = useCallback((message: string) => {
    setMessages((prev) => [...prev, `${new Date().toISOString()}: ${message}`]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const connect = useCallback((config: SimulationConfig) => {
    // Disconnect existing socket if connected
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }

    console.log("Creating new socket instance");
    const socketInstance = io(config.socketUrl, {
      autoConnect: false,
      reconnection: false,
      reconnectionAttempts: 0,
      reconnectionDelay: 0,
      forceNew: true,
    });
    setSocket(socketInstance);

    // Set up event listeners
    function onConnect() {
      setIsConnected(true);
      addMessage(`Connected to ${config.socketUrl}`);
    }

    function onDisconnect(reason: string) {
      console.log("Socket disconnected:", reason);
      setIsConnected(false);
      addMessage(`Disconnected from ${config.socketUrl} (reason: ${reason})`);
    }

    function onConnectError(error: Error) {
      console.log("Socket connect error:", error);
      addMessage(`Connection error: ${error.message}`);
      setIsConnected(false);
    }

    function onReconnectAttempt() {
      console.log("Socket reconnect attempt - blocking it!");
      addMessage("Reconnect attempt blocked");
      socketInstance.disconnect();
    }

    function onReconnect() {
      console.log("Socket reconnected - this should not happen!");
      addMessage("Unexpected reconnection occurred");
      socketInstance.disconnect();
    }

    function onPowerUpdate(data: PowerUpdateData) {
      if (setValue) {
        setValue("batteryCapacity", data.currentCapacity);
      }
      addMessage(`Power update: ${data.kwh} kWh charged, Current: ${data.currentCapacity}/${data.maxCapacity} kWh (${data.currentSOC.toFixed(1)}%)`);
    }

    function onHandshakeSuccess(data: HandshakeSuccessData) {
      addMessage(`Handshake success: ${data.message}`);
      addMessage(`Session ID: ${data.sessionId}`);
      addMessage(`Channel ID: ${data.channelId}`);
      addMessage(`Join Code: ${data.joinCode}`);
    }

    function onConnectionRejected(data: ConnectionRejectedData) {
      addMessage(`Connection rejected: ${data.message}`);
      setIsConnected(false);
    }

    function onChargingComplete(data: ChargingCompleteData) {
      addMessage(`Charging complete: ${data.message}`);
    }

    // Register event listeners
    socketInstance.on("connect", onConnect);
    socketInstance.on("disconnect", onDisconnect);
    socketInstance.on("connect_error", onConnectError);
    socketInstance.on("reconnect_attempt", onReconnectAttempt);
    socketInstance.on("reconnect", onReconnect);
    socketInstance.on("power_update", onPowerUpdate);
    socketInstance.on("handshake_success", onHandshakeSuccess);
    socketInstance.on("connection_rejected", onConnectionRejected);
    socketInstance.on("charging_complete", onChargingComplete);

    // Manually connect
    console.log("Manually connecting socket...");
    socketInstance.connect();

    // Send configuration after connection
    socketInstance.on("connect", () => {
      socketInstance.emit("configure_simulation", {
        batteryCapacity: config.batteryCapacity,
        maxCapacity: config.maxCapacity,
        targetSOC: config.targetSOC,
      });
      addMessage(`Sent configuration: ${config.batteryCapacity} kWh / ${config.maxCapacity} kWh max / ${config.targetSOC}% target SOC`);
    });

  }, [socket, addMessage]);

  const disconnect = useCallback(() => {
    console.log("handleDisconnect called");
    if (socket) {
      console.log("Disconnecting socket manually");
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      addMessage("Disconnected manually");
    } else {
      console.log("No socket to disconnect");
    }
  }, [socket, addMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  return {
    socket,
    isConnected,
    messages,
    connect,
    disconnect,
    clearMessages,
  };
}
