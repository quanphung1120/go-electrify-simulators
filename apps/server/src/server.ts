import express, { Application, Request, Response } from "express";
import cors from "cors";
import { createServer, Server as HTTPServer } from "http";
import { Server } from "socket.io";

export interface ServerComponents {
  app: Application;
  server: HTTPServer;
  io: Server;
}

export function createExpressApp(): ServerComponents {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  app.use(cors());
  app.use(express.json());

  app.get("/healthz", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      message: "Server is running",
    });
  });

  // app.get("/qr", async (req: Request, res: Response) => {
  //   try {
  //     if (!handshakeResponse?.data.joinCode) {
  //       return res.status(404).json({
  //         error: "Join code not available",
  //         message: "Handshake has not been completed yet",
  //       });
  //     }

  //     const qrCodeDataURL = await QRCode.toDataURL(handshakeResponse.joinCode, {
  //       width: 256,
  //       margin: 2,
  //       color: {
  //         dark: "#000000",
  //         light: "#FFFFFF",
  //       },
  //     });

  //     res.setHeader("Content-Type", "image/png");
  //     res.setHeader("Cache-Control", "public, max-age=300"); // Cache for 5 minutes

  //     // Convert data URL to buffer and send
  //     const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, "");
  //     const buffer = Buffer.from(base64Data, "base64");
  //     res.send(buffer);
  //   } catch (error) {
  //     console.error("Error generating QR code:", error);
  //     res.status(500).json({
  //       error: "Failed to generate QR code",
  //       message: error instanceof Error ? error.message : "Unknown error",
  //     });
  //   }
  // });

  return { app, server, io };
}
