import * as Ably from "ably";
import { SessionSpecs, StartSessionPayload } from "./types";

/**
 * Configuration for DockRealtime instance
 */
interface DockRealtimeConfig {
  ablyToken: string;
  dockId: string;
  channelId: string;
}

/**
 * Internal state for managing subscriptions and cleanup
 */
interface SubscriptionManager {
  sessionSpecsUnsubscribe: (() => void) | null;
  startSessionUnsubscribe: (() => void) | null;
}

/**
 * Ably Realtime client for dock communication
 */
export interface DockRealtimeInstance {
  connectAndAttachAsync: () => Promise<void>;
  onSessionSpecs: (callback: (specs: SessionSpecs) => void) => void;
  onStartSession: (
    callback: (payload: StartSessionPayload | null) => Promise<void>
  ) => void;
  publishEventAsync: (eventName: string, data: unknown) => Promise<void>;
  dispose: () => Promise<void>;
  getConnectionState: () => Ably.ConnectionState;
}

/**
 * Creates a new DockRealtime instance for managing Ably communication
 */
export function createDockRealtime(config: DockRealtimeConfig): DockRealtimeInstance {
  const { ablyToken, dockId, channelId } = config;

  // Initialize Ably client with proper configuration
  const client = new Ably.Realtime({
    token: ablyToken,
    autoConnect: false, // Manual connection control
    logLevel: 1, // Error level logging
  });

  const channel = client.channels.get(channelId);
  const subscriptions: SubscriptionManager = {
    sessionSpecsUnsubscribe: null,
    startSessionUnsubscribe: null,
  };

  /**
   * Establishes connection to Ably and attaches to the channel
   */
  async function connectAndAttachAsync(): Promise<void> {
    try {
      console.log(`[DockRealtime] Connecting to Ably for dock ${dockId}...`);

      // Connect to Ably
      await new Promise<void>((resolve, reject) => {
        client.connection.once("connected", () => resolve());
        client.connection.once("failed", (err) => reject(err));

        client.connect();
      });

      console.log(`[DockRealtime] Connected to Ably, attaching to channel ${channelId}...`);

      // Attach to channel
      await channel.attach();

      console.log(`[DockRealtime] Successfully attached to channel ${channelId}`);
    } catch (error) {
      console.error(`[DockRealtime] Failed to connect and attach:`, error);
      throw new Error(`Failed to establish Ably connection: ${error}`);
    }
  }

  /**
   * Subscribes to session_specs events
   */
  function onSessionSpecs(callback: (specs: SessionSpecs) => void): void {
    if (subscriptions.sessionSpecsUnsubscribe) {
      console.warn(`[DockRealtime] Session specs subscription already exists`);
      return;
    }

    const messageHandler = (message: Ably.Message) => {
      try {
        const specs = message.data as SessionSpecs;
        console.log(`[DockRealtime] Received session specs for dock ${dockId}`);
        callback(specs);
      } catch (error) {
        console.error(`[DockRealtime] Error processing session specs:`, error);
      }
    };

    channel.subscribe("session_specs", messageHandler);

    subscriptions.sessionSpecsUnsubscribe = () => {
      channel.unsubscribe("session_specs", messageHandler);
    };
  }

  /**
   * Subscribes to start_session and start_charging events
   */
  function onStartSession(
    callback: (payload: StartSessionPayload | null) => Promise<void>
  ): void {
    if (subscriptions.startSessionUnsubscribe) {
      console.warn(`[DockRealtime] Start session subscription already exists`);
      return;
    }

    const messageHandler = async (message: Ably.Message) => {
      try {
        const payload = message.data as StartSessionPayload;
        console.log(`[DockRealtime] Received ${message.name} event for dock ${dockId}`);
        await callback(payload);
      } catch (error) {
        console.error(`[DockRealtime] Error processing start session event:`, error);
        await callback(null);
      }
    };

    // Subscribe to both event types with the same handler
    channel.subscribe("start_session", messageHandler);
    channel.subscribe("start_charging", messageHandler);

    subscriptions.startSessionUnsubscribe = () => {
      channel.unsubscribe("start_session", messageHandler);
      channel.unsubscribe("start_charging", messageHandler);
    };
  }

  /**
   * Publishes an event to the channel
   */
  async function publishEventAsync(eventName: string, data: unknown): Promise<void> {
    try {
      console.log(`[DockRealtime] Publishing event ${eventName} to channel ${channelId}`);
      await channel.publish(eventName, data);
      console.log(`[DockRealtime] Successfully published event ${eventName}`);
    } catch (error) {
      console.error(`[DockRealtime] Failed to publish event ${eventName}:`, error);
      throw error;
    }
  }

  /**
   * Gets the current connection state
   */
  function getConnectionState(): Ably.ConnectionState {
    return client.connection.state;
  }

  /**
   * Cleans up resources and closes connections
   */
  async function dispose(): Promise<void> {
    console.log(`[DockRealtime] Disposing resources for dock ${dockId}...`);

    try {
      // Unsubscribe from all events
      if (subscriptions.sessionSpecsUnsubscribe) {
        subscriptions.sessionSpecsUnsubscribe();
        subscriptions.sessionSpecsUnsubscribe = null;
      }

      if (subscriptions.startSessionUnsubscribe) {
        subscriptions.startSessionUnsubscribe();
        subscriptions.startSessionUnsubscribe = null;
      }

      // Detach from channel and close client
      await channel.detach();
      client.close();

      console.log(`[DockRealtime] Successfully disposed resources for dock ${dockId}`);
    } catch (error) {
      console.error(`[DockRealtime] Error during disposal:`, error);
      // Don't throw - cleanup should be best effort
    }
  }

  return {
    connectAndAttachAsync,
    onSessionSpecs,
    onStartSession,
    publishEventAsync,
    dispose,
    getConnectionState,
  };
}
