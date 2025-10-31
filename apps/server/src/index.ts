import dotenv from "dotenv";

dotenv.config();

import { startDock } from "./AblyCore";
import { createSharedState } from "./state";
import { createExpressApp } from "./server";
import { setupSocketHandlers } from "./socketHandlers";
import { setupAblyIntegration } from "./ablyIntegration";

async function main(): Promise<void> {
  const PORT = process.env.PORT || 3001;

  // Create shared state
  const state = createSharedState();

  // Create Express app and Socket.IO server
  const { app, server, io } = createExpressApp();

  // Initialize dock handshake
  try {
    await startDock(state);
    console.log("Dock initialization successful");
    console.log(
      "The QR to connect to this dock is available at http://localhost:" +
        PORT +
        "/qr"
    );
  } catch (error) {
    console.error("Failed to initialize dock:", error);
    console.error("Application will exit due to dock initialization failure");
    process.exit(1);
  }

  // Setup Ably integration
  setupAblyIntegration(state);

  // Setup Socket.IO handlers
  setupSocketHandlers(io, state);

  // Start server
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
}

// Execute main function
main().catch((error) => {
  console.error("Unhandled error in main():", error);
  process.exit(1);
});
