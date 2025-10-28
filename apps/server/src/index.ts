import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { createDockAblyWorker, DockAblyWorkerInstance } from "./DockAblyWorker";
import { SimulationConfig } from "./types";

dotenv.config();

interface ExtendedSocket extends Socket {
  powerInterval?: NodeJS.Timeout;
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3001;

let connectedClients = 0;

let dockWorker: DockAblyWorkerInstance | null = null;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    message: "Server is running",
    connectedClients,
    dockWorker: dockWorker
      ? {
          dockId: dockWorker.getState().dockId,
          sessionId: dockWorker.getState().sessionId,
          channelId: dockWorker.getState().channelId,
          hasSpecs: !!dockWorker.getState().specs,
        }
      : null,
  });
});

const startChargingSimulation = (
  socket: ExtendedSocket,
  currentCapacity: number,
  maxCapacity: number,
  targetSOC: number
) => {
  const powerInterval = setInterval(async () => {
    const powerConsumptionPerSecond = 0.1;

    currentCapacity = Math.min(
      maxCapacity,
      currentCapacity + powerConsumptionPerSecond * 5
    );

    const currentSOC = (currentCapacity / maxCapacity) * 100;

    socket.emit("power_update", {
      kwh: powerConsumptionPerSecond * 5,
      currentCapacity: currentCapacity,
      maxCapacity: maxCapacity,
      currentSOC: currentSOC,
      timestamp: new Date().toISOString(),
    });

    if (dockWorker) {
      await dockWorker.handleSocTick(currentSOC, powerConsumptionPerSecond * 5);
    }

    console.log(
      `Power update sent - Current capacity: ${currentCapacity} kWh (${currentSOC.toFixed(1)}%)`
    );

    if (currentSOC >= targetSOC) {
      console.log(
        `Target SOC ${targetSOC}% reached. Stopping charging and disconnecting client.`
      );

      socket.emit("charging_complete", {
        message: `Charging complete! Reached target SOC of ${targetSOC}%`,
        finalCapacity: currentCapacity,
        finalSOC: currentSOC,
        timestamp: new Date().toISOString(),
      });

      if (dockWorker) {
        await dockWorker.handleChargingComplete(Math.round(currentSOC));
      }

      clearInterval(powerInterval);
      setTimeout(() => {
        socket.disconnect();
      }, 1000);
    }
  }, 5000);

  socket.powerInterval = powerInterval;
};

io.on("connection", (socket: ExtendedSocket) => {
  if (connectedClients >= 1) {
    console.log("Connection rejected: Another client is already connected");
    socket.emit("connection_rejected", {
      message: "Dock is already occupied by another vehicle",
      timestamp: new Date().toISOString(),
    });
    socket.disconnect();
    return;
  }

  connectedClients++;
  console.log(`Client connected. Total connected: ${connectedClients}`);
  console.log("A car connected:", socket.id);

  socket.on("configure_simulation", async (config: SimulationConfig) => {
    console.log(
      `Received configuration: Current: ${config.batteryCapacity} kWh, Max: ${config.maxCapacity} kWh, Target SOC: ${config.targetSOC}%`
    );

    try {
      const BACKEND_URL =
        process.env.BACKEND_URL ||
        "https://ev-backend-api-staging.goelectrify.app";
      const DOCK_ID = parseInt(process.env.DOCK_ID || "3374", 10);
      const DOCK_SECRET = process.env.DOCK_SECRET || "Dock-qWeR-01";

      dockWorker = createDockAblyWorker(BACKEND_URL, DOCK_ID, DOCK_SECRET);

      await dockWorker.start(
        (soc: number, power?: number) => {
          console.log(`[Main] SOC Update: ${soc}% Power: ${power}kW`);
        },
        async (targetSoc: number) => {
          console.log(`[Main] Charging started with target SOC: ${targetSoc}%`);
          startChargingSimulation(
            socket,
            config.batteryCapacity,
            config.maxCapacity,
            targetSoc
          );
        }
      );

      const state = dockWorker.getState();
      socket.emit("handshake_success", {
        sessionId: state.sessionId || 0,
        channelId: state.channelId || "unknown",
        joinCode: state.joinCode || "N/A",
        message:
          "Successfully connected to backend and Ably channel. Waiting for session_specs and start_session events.",
        timestamp: new Date().toISOString(),
      });

      console.log(
        `Backend handshake successful for socket: ${socket.id}, session: ${state.sessionId}, channel: ${state.channelId}, joinCode: ${state.joinCode}`
      );
    } catch (error) {
      console.error("Error in configure_simulation:", error);
      socket.emit("connection_rejected", {
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  });

  socket.on("disconnect", async () => {
    connectedClients--;
    console.log(
      `Car disconnected: ${socket.id}. Total connected: ${connectedClients}`
    );

    if (socket.powerInterval) {
      clearInterval(socket.powerInterval);
    }

    if (dockWorker) {
      await dockWorker.stop();
      dockWorker = null;
      console.log(`Stopped DockAblyWorker for socket: ${socket.id}`);
    }
  });
});

server
  .listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Process PID: ${process.pid}, PPID: ${process.ppid}`);
  })
  .on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} is already in use. Please kill the process using it or use a different port.`
      );
      console.error(
        "You can kill the process with: lsof -ti:3001 | xargs kill -9"
      );
      process.exit(1);
    } else {
      throw err;
    }
  });
