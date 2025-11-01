---
mode: agent
model: Claude Sonnet 4.5 (copilot)
description: Clean up chaotic client-server communication with standardized schemas and Zod transforms to handle API naming differences.
---

# 🚀 Go-Electrify Communication Architecture Refactor

## GitHub Copilot Implementation Guide

## 🎯 Objective

Clean up chaotic client-server communication with standardized schemas and Zod transforms to handle API naming differences.

## 📋 Current Issues

- Inconsistent naming: `targetSOC`, `target_soc`, `TargetSOC`, `targetSoc`
- No runtime validation
- Mixed event naming conventions
- No separation between Socket.IO and Ably handlers
- API responses may have different field names than internal types

## 🛠️ Implementation Strategy

### Phase 1: Create Shared Types with Zod Transforms

#### 1.1 Create Package Structure

```bash
mkdir -p packages/shared-types/src
cd packages/shared-types
```

#### 1.2 Package Configuration

```json
// packages/shared-types/package.json
{
  "name": "@go-electrify/shared-types",
  "version": "1.0.0",
  "description": "Shared types with Zod validation and transforms",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

#### 1.3 Zod Schemas with Transforms

```typescript
// packages/shared-types/src/schemas.ts
import { z } from "zod";

// API Response Schemas (with transforms to standardize naming)
export const apiHandshakeResponseSchema = z
  .object({
    sessionId: z.number(),
    channelId: z.string(),
    dockJwt: z.string(),
    ablyToken: z.string().optional(),
    joinCode: z.string().optional(),
    expiresAt: z.string().optional(),
    charger: z
      .object({
        id: z.number(),
        code: z.string(),
        stationId: z.number(),
        connectorTypeId: z.number(),
        powerKw: z.number(),
        status: z.string(),
        dockStatus: z.string(),
        ablyChannel: z.string(),
        lastConnectedAt: z.string().nullable(),
        lastPingAt: z.string().nullable(),
        pricePerKwh: z.number(),
      })
      .optional(),
  })
  .transform((data) => ({
    sessionId: data.sessionId,
    channelId: data.channelId,
    dockJwt: data.dockJwt,
    ablyToken: data.ablyToken,
    joinCode: data.joinCode,
    expiresAt: data.expiresAt,
    charger: data.charger,
  }));

// Ably Message Schemas (handle API naming variations)
export const ablyStartSessionSchema = z
  .object({
    targetSOC: z.number().optional(),
    target_soc: z.number().optional(),
    TargetSOC: z.number().optional(),
  })
  .transform((data) => {
    // Normalize to internal naming convention
    const targetSOC = data.targetSOC ?? data.target_soc ?? data.TargetSOC;
    return { targetSOC };
  });

export const ablySessionSpecsSchema = z
  .object({
    sessionId: z.number(),
    vehicle: z.object({
      batteryCapacityKwh: z.number(),
      maxPowerKw: z.number(),
    }),
    charger: z.object({
      powerKw: z.number(),
    }),
    initialSoc: z.number().optional(),
    targetSoc: z.number(),
  })
  .transform((data) => ({
    sessionId: data.sessionId,
    vehicle: {
      batteryCapacityKwh: data.vehicle.batteryCapacityKwh,
      maxPowerKw: data.vehicle.maxPowerKw,
    },
    charger: {
      powerKw: data.charger.powerKw,
    },
    initialSoc: data.initialSoc,
    targetSoc: data.targetSoc, // Keep API naming for consistency
  }));

// Socket.IO Message Schemas
export const socketCarConfigSchema = z.object({
  batteryCapacity: z.number().positive(),
  maxCapacity: z.number().positive(),
  timestamp: z.string().datetime(),
});

export const socketHandshakeSuccessSchema = z.object({
  sessionId: z.number().positive(),
  channelId: z.string().min(1),
  joinCode: z.string().min(1),
  message: z.string().min(1),
  timestamp: z.string().datetime(),
});

export const socketPowerUpdateSchema = z.object({
  kwh: z.number().nonnegative(),
  currentCapacity: z.number().nonnegative(),
  maxCapacity: z.number().positive(),
  currentSOC: z.number().min(0).max(100),
  timestamp: z.string().datetime(),
});
```

#### 1.4 Event Constants

```typescript
// packages/shared-types/src/events.ts
export const SOCKET_EVENTS = {
  CAR_CONFIGURE: "car_configure",
  HANDSHAKE_SUCCESS: "handshake_success",
  POWER_UPDATE: "power_update",
  CHARGING_COMPLETE: "charging_complete",
  CONNECTION_REJECTED: "connection_rejected",
  VALIDATION_ERROR: "validation_error",
} as const;

export const ABLY_EVENTS = {
  SESSION_SPECS: "session_specs",
  LOAD_CAR_INFO: "load_car_information",
  START_SESSION: "start_session",
  DOCK_HEARTBEAT: "dock_heartbeat",
  CAR_INFO: "car_information",
  CHARGING_EVENT: "charging_event",
} as const;
```

#### 1.5 Type Definitions

```typescript
// packages/shared-types/src/messages.ts
import { z } from "zod";
import {
  socketCarConfigSchema,
  socketHandshakeSuccessSchema,
  socketPowerUpdateSchema,
  ablyStartSessionSchema,
  ablySessionSpecsSchema,
  apiHandshakeResponseSchema,
} from "./schemas";

// Internal types (standardized naming)
export type CarConfigMessage = z.infer<typeof socketCarConfigSchema>;
export type HandshakeSuccessMessage = z.infer<
  typeof socketHandshakeSuccessSchema
>;
export type PowerUpdateMessage = z.infer<typeof socketPowerUpdateSchema>;
export type StartSessionMessage = z.infer<typeof ablyStartSessionSchema>;
export type SessionSpecsMessage = z.infer<typeof ablySessionSpecsSchema>;
export type ApiHandshakeResponse = z.infer<typeof apiHandshakeResponseSchema>;

// Legacy types for backward compatibility
export interface LegacySimulationConfig {
  batteryCapacity: number;
  maxCapacity: number;
  targetSOC?: number;
  timestamp: string;
}
```

#### 1.6 Validation Utilities with Transforms

```typescript
// packages/shared-types/src/validators.ts
import { z } from "zod";

export class ValidationError extends Error {
  constructor(
    message: string,
    public eventName?: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validateIncomingMessage<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  eventName: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        `Invalid ${eventName} message: ${error.errors.map((e) => e.message).join(", ")}`,
        eventName
      );
    }
    throw new ValidationError(
      `Invalid ${eventName} message: ${error}`,
      eventName
    );
  }
}

export function validateApiResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  apiName: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        `Invalid ${apiName} response: ${error.errors.map((e) => e.message).join(", ")}`,
        apiName
      );
    }
    throw new ValidationError(`Invalid ${apiName} response: ${error}`, apiName);
  }
}

// Transform utilities for API compatibility
export function transformToApiFormat<T extends Record<string, any>>(
  data: T,
  fieldMappings: Record<string, string>
): T {
  const transformed = { ...data };
  Object.entries(fieldMappings).forEach(([internalField, apiField]) => {
    if (transformed[internalField] !== undefined) {
      transformed[apiField] = transformed[internalField];
      delete transformed[internalField];
    }
  });
  return transformed;
}

export function transformFromApiFormat<T extends Record<string, any>>(
  data: T,
  fieldMappings: Record<string, string>
): T {
  const transformed = { ...data };
  Object.entries(fieldMappings).forEach(([apiField, internalField]) => {
    if (transformed[apiField] !== undefined) {
      transformed[internalField] = transformed[apiField];
      delete transformed[apiField];
    }
  });
  return transformed;
}
```

### Phase 2: Update Server Implementation

#### 2.1 Update Ably Integration with Transforms

```typescript
// apps/server/src/ablyIntegration.ts
import {
  validateIncomingMessage,
  ablyStartSessionSchema,
  ablySessionSpecsSchema,
  ABLY_EVENTS,
  StartSessionMessage,
  SessionSpecsMessage,
} from "@go-electrify/shared-types";

export function setupAblyIntegration(state: SharedState) {
  // ... existing setup code ...

  channel.subscribe(ABLY_EVENTS.START_SESSION, (message) => {
    try {
      const sessionData: StartSessionMessage = validateIncomingMessage(
        ablyStartSessionSchema,
        message.data,
        ABLY_EVENTS.START_SESSION
      );

      // Now targetSOC is consistently named regardless of API format
      if (sessionData.targetSOC) {
        state.targetSOC = sessionData.targetSOC;
        console.log(`Target SOC set to: ${state.targetSOC}%`);
      }

      // Start charging...
    } catch (error) {
      console.error("Start session validation failed:", error);
    }
  });

  channel.subscribe(ABLY_EVENTS.SESSION_SPECS, (message) => {
    try {
      const specs: SessionSpecsMessage = validateIncomingMessage(
        ablySessionSpecsSchema,
        message.data,
        ABLY_EVENTS.SESSION_SPECS
      );

      console.log(`Session specs received:`, specs);
      // Handle session specs...
    } catch (error) {
      console.error("Session specs validation failed:", error);
    }
  });
}
```

#### 2.2 Update Socket Handlers

```typescript
// apps/server/src/socketHandlers.ts
import {
  validateIncomingMessage,
  socketCarConfigSchema,
  SOCKET_EVENTS,
  CarConfigMessage,
} from "@go-electrify/shared-types";

export function setupSocketHandlers(io: Server, state: SharedState): void {
  io.on("connection", async (socket: Socket) => {
    // ... existing connection logic ...

    socket.on(SOCKET_EVENTS.CAR_CONFIGURE, (data: unknown) => {
      try {
        const config: CarConfigMessage = validateIncomingMessage(
          socketCarConfigSchema,
          data,
          SOCKET_EVENTS.CAR_CONFIGURE
        );

        state.currentCapacity = config.batteryCapacity;
        state.maxCapacity = config.maxCapacity;

        socket.emit(SOCKET_EVENTS.CONFIGURATION_COMPLETE, {
          message: "Vehicle configured successfully",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        socket.emit(SOCKET_EVENTS.VALIDATION_ERROR, {
          event: SOCKET_EVENTS.CAR_CONFIGURE,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });
  });
}
```

### Phase 3: Update Client Implementation

#### 3.1 Update Client App.tsx

```typescript
// apps/client/src/App.tsx
import {
  validateOutgoingMessage,
  socketCarConfigSchema,
  SOCKET_EVENTS,
  CarConfigMessage,
  HandshakeSuccessMessage,
  PowerUpdateMessage,
} from "@go-electrify/shared-types";

function App() {
  // ... existing state ...

  const onSubmit = (data: FormData) => {
    // ... existing socket setup ...

    socketInstance.once("connect", () => {
      const configMessage: CarConfigMessage = {
        batteryCapacity: data.batteryCapacity,
        maxCapacity: data.maxCapacity,
        timestamp: new Date().toISOString(),
      };

      // Validate before sending
      const validatedConfig = validateOutgoingMessage(
        socketCarConfigSchema,
        configMessage,
        SOCKET_EVENTS.CAR_CONFIGURE
      );

      socketInstance.emit(SOCKET_EVENTS.CAR_CONFIGURE, validatedConfig);
      addMessage(`Configuration sent`);
    });
  };

  useEffect(() => {
    if (!socket) return;

    // Use standardized event names
    socket.on(
      SOCKET_EVENTS.HANDSHAKE_SUCCESS,
      (data: HandshakeSuccessMessage) => {
        setJoinCode(data.joinCode);
        setSessionId(data.sessionId);
        addMessage(`${data.message}`);
        addMessage(`Session ID: #${data.sessionId}`);
        addMessage(`Channel ID: ${data.channelId}`);
        addMessage(`Join Code: ${data.joinCode}`);
      }
    );

    socket.on(SOCKET_EVENTS.POWER_UPDATE, (data: PowerUpdateMessage) => {
      setValue("batteryCapacity", data.currentCapacity);
      setIsCharging(true);
      addMessage(
        `Power update: +${data.kwh.toFixed(2)} kWh | ${data.currentCapacity.toFixed(1)}/${data.maxCapacity} kWh (${data.currentSOC.toFixed(1)}%)`
      );
    });

    // ... other handlers ...
  }, [socket, setValue]);
}
```

### Phase 4: Update API Calls with Transforms

#### 4.1 Update AblyCore.ts

```typescript
// apps/server/src/AblyCore.ts
import {
  validateApiResponse,
  apiHandshakeResponseSchema,
  transformToApiFormat,
  ApiHandshakeResponse,
} from "@go-electrify/shared-types";

export async function performHandshake(state: SharedState): Promise<void> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/docks/handshake`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dockId: process.env.DOCK_ID,
        secretKey: process.env.DOCK_SECRET,
      }),
    });

    if (!response.ok) {
      throw new Error(`Handshake failed: ${response.status}`);
    }

    const rawData = await response.json();

    // Validate and transform API response
    const handshakeData: ApiHandshakeResponse = validateApiResponse(
      apiHandshakeResponseSchema,
      rawData,
      "handshake API"
    );

    state.handshakeResponse = handshakeData;
    state.isHandshakeComplete = true;
  } catch (error) {
    console.error("Handshake error:", error);
    throw error;
  }
}
```

## 🚀 Quick Implementation

```bash
# 1. Create shared-types package
mkdir -p packages/shared-types/src
cd packages/shared-types

# 2. Install dependencies
pnpm add zod
pnpm add -D typescript

# 3. Create files as shown above
# (Copy the code blocks above to respective files)

# 4. Build package
pnpm build

# 5. Update workspace
cd ../..
pnpm install

# 6. Update server imports
cd apps/server
# Replace existing imports with @go-electrify/shared-types

# 7. Update client imports
cd ../client
# Replace existing imports with @go-electrify/shared-types

# 8. Test
pnpm dev
```

## 🎯 Key Benefits

- **🔄 API Compatibility**: Zod transforms handle naming differences automatically
- **✅ Runtime Validation**: All messages validated before processing
- **📝 Type Safety**: Full TypeScript support with inferred types
- **🔧 Maintainable**: Centralized schemas and transforms
- **🚀 Backward Compatible**: Gradual migration with legacy support

## 📋 Success Criteria

- [ ] Zod transforms handle all API naming variations
- [ ] Runtime validation catches invalid messages
- [ ] TypeScript provides full type safety
- [ ] No breaking changes to existing functionality
- [ ] All tests pass with various naming conventions</content>
      <parameter name="filePath">/home/lenovo/go-electrify-simulators/COPILOT_PROMPT.md
