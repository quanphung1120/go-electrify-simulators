import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

let isLoaded = false;

export function ensureEnvLoaded(): void {
  if (isLoaded) {
    return;
  }

  const candidates = [
    process.env.SERVER_ENV_PATH,
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "apps/server/.env"),
    path.resolve(__dirname, "../.env"),
    path.resolve(__dirname, "../../.env"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate });
      isLoaded = true;
      return;
    }
  }

  dotenv.config();
  isLoaded = true;
}

ensureEnvLoaded();
