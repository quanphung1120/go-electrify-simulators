import axios, { AxiosInstance } from "axios";
import { createDockRealtime, DockRealtimeInstance } from "./DockRealtime";
import {
  SessionSpecs,
  HandshakeResponse,
  StopSessionDto,
  DockLogRequest,
  StartSessionPayload,
} from "./types";

export type DockState = {
  dockId: number;
  sessionId: number | null;
  channelId: string | null;
  dockJwt: string | null;
  joinCode: string | null;
  realtime: DockRealtimeInstance | null;
  specs: SessionSpecs | null;
  lastEnergyKwh: number;
  lastTickAt: Date | null;
  lastPowerKw: number | null;
  lastPowerAt: Date | null;
};

export type DockAblyWorkerInstance = {
  start: (
    onSocUpdate: (soc: number, power?: number) => void,
    onChargingStart: (targetSoc: number) => Promise<void>
  ) => Promise<void>;
  handleSocTick: (currentSoc: number, powerFromCar?: number) => Promise<void>;
  handleChargingComplete: (finalSoc: number) => Promise<void>;
  stop: () => Promise<void>;
  getChannelId: () => string | null;
  getState: () => DockState;
};

export function createDockAblyWorker(
  backendUrl: string,
  dockId: number,
  secret: string
): DockAblyWorkerInstance {
  const state: DockState = {
    dockId,
    sessionId: null,
    channelId: null,
    dockJwt: null,
    joinCode: null,
    realtime: null,
    specs: null,
    lastEnergyKwh: 0,
    lastTickAt: null,
    lastPowerKw: null,
    lastPowerAt: null,
  };

  const api: AxiosInstance = axios.create({
    baseURL: backendUrl,
    headers: { "Content-Type": "application/json" },
  });

  let isRunning = false;

  async function start(
    onSocUpdate: (soc: number, power?: number) => void,
    onChargingStart: (targetSoc: number) => Promise<void>
  ): Promise<void> {
    if (isRunning) return;
    isRunning = true;

    try {
      const hsResp = await api.post<{ data: HandshakeResponse }>(
        `/api/v1/docks/${dockId}/handshake`,
        { secretKey: secret }
      );

      const payload = hsResp.data.data;
      const { sessionId, channelId, dockJwt, ablyToken, joinCode } = payload;

      state.sessionId = sessionId;
      state.channelId = channelId;
      state.dockJwt = dockJwt;
      state.joinCode = joinCode ?? null;

      if (!ablyToken) {
        console.error(
          "[Dock] Handshake missing ablyToken. Cannot receive session_specs."
        );
        return;
      }

      api.defaults.headers.common["Authorization"] = `Bearer ${dockJwt}`;

      const rt = createDockRealtime({
        ablyToken,
        dockId: `dock-${dockId}`,
        channelId,
      });
      await rt.connectAndAttachAsync();
      state.realtime = rt;

      rt.onSessionSpecs((specs) => {
        state.specs = specs;
        state.lastTickAt = null;
        state.lastEnergyKwh = 0;
      });

      rt.onStartSession(async (payload: StartSessionPayload | null) => {
        const target = payload?.TargetSOC ?? payload?.target_soc ?? 80;
        await onChargingStart(target);
      });
    } catch (err) {
      isRunning = false;
      throw err;
    }
  }

  async function handleSocTick(currentSoc: number, powerFromCar?: number) {
    try {
      const now = new Date();

      if (!state.specs) {
        const minimal: DockLogRequest = {
          dockId,
          secretKey: secret,
          sampleAt: now.toISOString(),
          socPercent: Math.round(Math.max(0, Math.min(100, currentSoc))),
          state: "CHARGING",
        };

        try {
          await api.post("/api/v1/docks/log", minimal);
        } catch (error) {
          console.error("[Dock] POST /docks/log FAILED (minimal):", error);
          return;
        }

        if (state.realtime) {
          await state.realtime.publishEventAsync("telemetry", {
            currentSOC: currentSoc,
            at: now,
          });
        }

        return;
      }

      const battKwh = Math.max(0, state.specs.vehicle.batteryCapacityKwh);
      const initSoc = Math.max(
        0,
        Math.min(100, state.specs.initialSoc ?? currentSoc)
      );
      const socNow = currentSoc;
      const socInt = Math.round(Math.max(0, Math.min(100, socNow)));
      const sessionEnergy =
        battKwh > 0 ? Math.max(0, ((socNow - initSoc) / 100) * battKwh) : 0;

      let powerKw: number | null = null;
      if (state.lastTickAt) {
        const dtSec = (now.getTime() - state.lastTickAt.getTime()) / 1000;
        const dE = sessionEnergy - state.lastEnergyKwh;

        if (dtSec > 0.2 && dtSec < 5 && dE >= 0) {
          const pEst = (dE * 3600) / dtSec;
          const pCap = Math.min(
            Math.max(0, state.specs.vehicle.maxPowerKw),
            Math.max(0, state.specs.charger.powerKw)
          );
          powerKw = Math.max(0, Math.min(pEst, pCap));

          if (powerKw > 0) {
            state.lastPowerKw = powerKw;
            state.lastPowerAt = now;
          }
        }
      }

      const POWER_HOLD_SECONDS = 3.0;
      if (
        (!powerKw || powerKw === 0) &&
        state.lastPowerKw &&
        state.lastPowerKw > 0 &&
        state.lastPowerAt
      ) {
        if (
          (now.getTime() - state.lastPowerAt.getTime()) / 1000 <=
          POWER_HOLD_SECONDS
        ) {
          powerKw = state.lastPowerKw;
        } else {
          state.lastPowerKw = null;
        }
      }

      state.lastTickAt = now;
      state.lastEnergyKwh = sessionEnergy;

      const body: DockLogRequest = {
        dockId,
        secretKey: secret,
        sampleAt: now.toISOString(),
        socPercent: socInt,
        state: "CHARGING",
        powerKw: powerKw ?? undefined,
        voltage: undefined,
        current: undefined,
        sessionEnergyKwh: sessionEnergy,
      };

      try {
        await api.post("/api/v1/docks/log", body);
      } catch (error) {
        console.error("[Dock] POST /docks/log FAILED (full):", error);
      }

      if (state.realtime) {
        await state.realtime.publishEventAsync("telemetry", {
          currentSOC: socNow,
          powerKw,
          energyKwh: sessionEnergy,
          at: now,
        });
      }
    } catch (error) {
      console.warn("[Dock] log tick failed:", error);
    }
  }

  async function handleChargingComplete(finalSoc: number) {
    try {
      const now = new Date();

      const parkingTick: DockLogRequest = {
        dockId,
        secretKey: secret,
        sampleAt: now.toISOString(),
        socPercent: finalSoc,
        state: "PARKING",
        powerKw: 0,
        voltage: undefined,
        current: undefined,
        sessionEnergyKwh: state.lastEnergyKwh,
      };

      await api.post("/api/v1/docks/log", parkingTick);

      if (state.sessionId) {
        const stopOk = await stopSessionAsync(state.sessionId, {
          reason: "target_soc",
          finalSoc: finalSoc,
          energyKwh: Math.round(state.lastEnergyKwh * 10000) / 10000,
        });

        if (!stopOk) {
          console.warn(`[Dock] Stop FAILED for session ${state.sessionId}`);
        }
      }
    } catch (error) {
      console.warn("[Dock] complete failed:", error);
    }
  }

  async function stopSessionAsync(
    sessionId: number,
    dto: StopSessionDto
  ): Promise<boolean> {
    try {
      await api.post(`/api/v1/charging-sessions/${sessionId}/stop`, dto);
      return true;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404 || error.response?.status === 405) {
          try {
            await api.post(`/api/v1/sessions/${sessionId}/complete`, dto);
            return true;
          } catch (legacyError) {
            console.warn("[Dock] Legacy complete also failed:", legacyError);
            return false;
          }
        }
      }
      console.warn("[Dock] StopSession failed:", error);
      return false;
    }
  }

  async function stop() {
    isRunning = false;
    if (state.realtime) {
      await state.realtime.dispose();
      state.realtime = null;
    }
  }

  function getChannelId(): string | null {
    return state.channelId;
  }

  function getState(): DockState {
    return state;
  }

  return {
    start,
    handleSocTick,
    handleChargingComplete,
    stop,
    getChannelId,
    getState,
  };
}
