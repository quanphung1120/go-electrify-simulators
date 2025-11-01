import dotenv from "dotenv";

dotenv.config();

import { createSharedState } from "./state";
import { createExpressApp } from "./server";
import { setupSocketHandlers } from "./socketHandlers";

async function main(): Promise<void> {
  const PORT = process.env.PORT || 3001;

  // Create shared state
  const state = createSharedState();

  // Create Express app and Socket.IO server
  const { app, server, io } = createExpressApp();

  // Setup Socket.IO handlers (handshake will be triggered when car connects)
  setupSocketHandlers(io, state);

  // Start server
  server
    .listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Process PID: ${process.pid}, PPID: ${process.ppid}`);
      console.log("Waiting for car connection to initiate handshake...");
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
