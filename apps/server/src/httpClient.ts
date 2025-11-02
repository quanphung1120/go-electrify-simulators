import "./env";
import axios, { AxiosRequestConfig } from "axios";

const baseURL = process.env.BACKEND_URL;

const config: AxiosRequestConfig = {
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
};

if (baseURL) {
  config.baseURL = baseURL;
} else {
  console.warn(
    "BACKEND_URL is not set; axios requests must use absolute URLs."
  );
}

export const backendClient = axios.create(config);

export function formatAxiosError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;
    const statusText = status ? `status ${status}` : "no status";

    if (typeof data === "string") {
      return `${statusText}: ${data}`;
    }

    if (data && typeof data === "object") {
      try {
        return `${statusText}: ${JSON.stringify(data)}`;
      } catch {
        return `${statusText}: [object cannot be stringified]`;
      }
    }

    return `${statusText}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function getAxiosErrorStatus(error: unknown): number | undefined {
  if (axios.isAxiosError(error)) {
    return error.response?.status;
  }

  return undefined;
}
