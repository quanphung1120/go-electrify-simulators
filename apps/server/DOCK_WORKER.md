# Dock Ably Worker Integration

This server now includes a DockAblyWorker that connects to your backend API to handle charging session management via Ably Realtime.

## Architecture

The implementation is split into clean, modular files:

- **`types.ts`** - All TypeScript interfaces and type definitions
- **`DockRealtime.ts`** - Ably Realtime connection handler
- **`DockAblyWorker.ts`** - Main worker that handles backend handshake and session management
- **`index.ts`** - Express server with Socket.IO integration

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
PORT=3001
ABLY_API_KEY=your-ably-api-key

# Backend Configuration
BACKEND_URL=http://localhost:8000
DOCK_ID=1
DOCK_SECRET=your-dock-secret
```

## How It Works

### 1. Server Startup

When the server starts, it automatically:

- Performs handshake with the backend API (`POST /api/v1/docks/{dockId}/handshake`)
- Receives session info: `sessionId`, `channelId`, `dockJwt`, `ablyToken`
- Connects to Ably Realtime using the provided token
- Subscribes to the dock's channel for events

### 2. Session Flow

**Backend → Dock:**

- `session_specs` - Receives vehicle/charger specifications
- `start_session` - Dashboard triggers charging to start

**Dock → Backend:**

- Continuous telemetry logs via `POST /api/v1/docks/log`
- Session completion via `POST /api/v1/charging-sessions/{id}/stop`

### 3. Real-time Telemetry

The worker calculates and sends:

- **SOC (State of Charge)** - Current battery percentage
- **Power (kW)** - Calculated from ΔEnergy/ΔTime
- **Energy (kWh)** - Total session energy based on SOC change
- **State** - CHARGING or PARKING

### 4. Power Calculation

Power is calculated using real session specs from backend:

```typescript
Power (kW) = (ΔEnergy × 3600) / ΔTime
Capped by: min(Vehicle.MaxPowerKw, Charger.PowerKw)
```

## API Endpoints

### GET /api/health

Check server status and dock worker state

```json
{
  "status": "ok",
  "connectedClients": 1,
  "dockWorker": {
    "dockId": 1,
    "sessionId": 123,
    "channelId": "dock-01",
    "hasSpecs": true
  }
}
```

### POST /api/dock/reconnect

Manually reconnect the dock worker to backend

```bash
curl -X POST http://localhost:3001/api/dock/reconnect
```

## Integration with Socket.IO Simulator

The existing Socket.IO car simulator can work alongside the DockAblyWorker:

1. Car connects via Socket.IO (existing flow)
2. DockAblyWorker handles backend communication
3. SOC updates from car trigger telemetry to backend
4. Dashboard can control charging via Ably

## Usage Example

```typescript
// The worker is started automatically on server startup
// You can hook into SOC updates and charging commands:

await dockWorker.start(
  (soc: number, power?: number) => {
    // Handle SOC update
    console.log(`SOC: ${soc}% Power: ${power}kW`);
  },
  async (targetSoc: number) => {
    // Handle charging start command from dashboard
    console.log(`Start charging to ${targetSoc}%`);
    // Send command to car via Socket.IO
    socket.emit("start_charging", { targetSoc });
  }
);
```

## Key Features

✅ **Type-safe** - Full TypeScript with proper interfaces  
✅ **Modular** - Clean separation of concerns  
✅ **Error handling** - Graceful fallbacks and retries  
✅ **Real-time** - Ably Realtime integration  
✅ **Backend sync** - Automatic handshake and session management  
✅ **Power calculation** - Smart ΔE/Δt with holding logic  
✅ **Reconnection** - Manual reconnect endpoint available

## Development

```bash
# Install dependencies
pnpm install

# Development mode with hot reload
pnpm dev

# Build
pnpm build

# Production
pnpm start
```

## Differences from C# Version

1. **Async/Await** - Uses native Promise-based async
2. **Axios** - HTTP client instead of HttpClientFactory
3. **Ably SDK** - Direct Ably Realtime client
4. **Express** - REST API endpoints
5. **Event Emitters** - Callback-based instead of C# events

## Next Steps

To fully integrate with your car simulator:

1. Connect SOC updates to `dockWorker.handleSocTick()`
2. Connect charging completion to `dockWorker.handleChargingComplete()`
3. Handle start_session commands in your Socket.IO logic
