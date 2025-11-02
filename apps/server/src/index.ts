import "./env";

import { createSharedState } from "./state";
import { createExpressApp } from "./server";
import { setupSocketHandlers } from "./socketHandlers";
import { startPingInterval } from "./ablyCore";

async function main(): Promise<void> {
  const envPort = Number(process.env.PORT);
  const port = Number.isFinite(envPort) && envPort > 0 ? envPort : 3001;

  const state = createSharedState();

  const { server, io } = createExpressApp();

  setupSocketHandlers(io, state);

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Process PID: ${process.pid}, PPID: ${process.ppid}`);

    // Start ping interval when dock turns on
    startPingInterval(state);
    console.log("Dock ping started - keeping connection alive with backend");

    console.log("Waiting for car connection to initiate handshake...");
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use. Please kill the process using it or use a different port.`
      );
      console.error(
        `You can kill the process with: lsof -ti:${port} | xargs kill -9`
      );
      if (process.env.NODE_ENV !== "test") {
        process.exit(1);
      }
      return;
    }

    console.error("HTTP server error encountered:", err);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error("Unhandled error during startup:", error);
  if (process.env.NODE_ENV !== "test") {
    process.exit(1);
  }
});
