import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SOCKET_EVENTS } from "@go-electrify/shared-types";
import type {
  HandshakeSuccessMessage,
  PowerUpdateMessage,
  ChargingCompleteMessage,
  ConnectionRejectedMessage,
} from "@go-electrify/shared-types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { ScrollArea } from "./components/ui/scroll-area";
import { Progress } from "./components/ui/progress";
import { Badge } from "./components/ui/badge";
import { Separator } from "./components/ui/separator";
import { ModeToggle } from "./components/mode-toggle";
import QRCode from "react-qr-code";
import "./App.css";

const formSchema = z.object({
  batteryCapacity: z.number().min(0),
  maxCapacity: z.number().min(0),
  socketUrl: z.url(),
});

type FormData = z.infer<typeof formSchema>;

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isCharging, setIsCharging] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      batteryCapacity: 100,
      maxCapacity: 200,
      socketUrl: "http://localhost:3001",
    },
  });

  const batteryCapacity = watch("batteryCapacity");
  const maxCapacity = watch("maxCapacity");

  const addMessage = (message: string) => {
    const now = new Date();
    const timestamp = now.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    setMessages((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  useEffect(() => {
    if (!socket) return;

    function onConnect() {
      setIsConnected(true);
      addMessage(`Connected to server`);
    }

    function onDisconnect() {
      setIsConnected(false);
      setJoinCode(null);
      setSessionId(null);
      setIsCharging(false);
      addMessage(`Disconnected from server`);
    }

    function onPowerUpdate(data: PowerUpdateMessage) {
      setValue("batteryCapacity", data.currentCapacity);
      setIsCharging(true);
      addMessage(
        `Power update: +${data.kwh.toFixed(2)} kWh | ${data.currentCapacity.toFixed(1)}/${data.maxCapacity} kWh (${data.currentSOC.toFixed(1)}%)`
      );
    }

    function onHandshakeSuccess(data: HandshakeSuccessMessage) {
      setJoinCode(data.joinCode);
      setSessionId(data.sessionId);
      addMessage(`${data.message}`);
      addMessage(`Session ID: #${data.sessionId}`);
      addMessage(`Channel ID: ${data.channelId}`);
      addMessage(`Join Code: ${data.joinCode}`);
    }

    function onConnectionRejected(data: ConnectionRejectedMessage) {
      addMessage(`Connection rejected: ${data.reason}`);
      setIsConnected(false);
      setJoinCode(null);
      setSessionId(null);
    }

    function onChargingComplete(data: ChargingCompleteMessage) {
      setIsCharging(false);
      addMessage(`${data.message}`);
      addMessage(
        `Final capacity: ${data.finalCapacity.toFixed(1)} kWh (${data.finalSOC.toFixed(1)}%)`
      );
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(SOCKET_EVENTS.POWER_UPDATE, onPowerUpdate);
    socket.on(SOCKET_EVENTS.HANDSHAKE_SUCCESS, onHandshakeSuccess);
    socket.on(SOCKET_EVENTS.CONNECTION_REJECTED, onConnectionRejected);
    socket.on(SOCKET_EVENTS.CHARGING_COMPLETE, onChargingComplete);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(SOCKET_EVENTS.POWER_UPDATE, onPowerUpdate);
      socket.off(SOCKET_EVENTS.HANDSHAKE_SUCCESS, onHandshakeSuccess);
      socket.off(SOCKET_EVENTS.CONNECTION_REJECTED, onConnectionRejected);
      socket.off(SOCKET_EVENTS.CHARGING_COMPLETE, onChargingComplete);
    };
  }, [socket, setValue]);

  const onSubmit = (data: FormData) => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }

    const socketInstance = io(data.socketUrl, {
      autoConnect: false,
    });

    setSocket(socketInstance);
    socketInstance.connect();

    socketInstance.once("connect", () => {
      addMessage("Connected to server, waiting for handshake...");
    });

    // Send configuration after handshake is complete
    socketInstance.once(SOCKET_EVENTS.HANDSHAKE_SUCCESS, () => {
      socketInstance.emit(SOCKET_EVENTS.CAR_CONFIGURE, {
        batteryCapacity: data.batteryCapacity,
        maxCapacity: data.maxCapacity,
        timestamp: new Date().toISOString(),
      });
      addMessage(
        `Configuration sent: ${data.batteryCapacity} kWh / ${data.maxCapacity} kWh`
      );
    });
  };

  const handleDisconnect = () => {
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setJoinCode(null);
      setSessionId(null);
      setIsCharging(false);
      addMessage("Disconnected manually");
    }
  };

  const batteryPercentage =
    maxCapacity > 0 ? (batteryCapacity / maxCapacity) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="text-left">
            <h1 className="text-xl font-semibold">Go-Electrify Simulator</h1>
            <p className="text-xs text-muted-foreground">
              Electric Vehicle Charging Dock
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isConnected && (
              <Badge
                variant={isCharging ? "default" : "secondary"}
                className="text-xs"
              >
                {isCharging ? "CHARGING" : "CONNECTED"}
              </Badge>
            )}
            <ModeToggle />
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Vehicle Configuration</CardTitle>
              <CardDescription>
                Connect your EV to the charging dock
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="batteryCapacity">
                    Current Capacity (kWh)
                  </Label>
                  <Input
                    id="batteryCapacity"
                    type="number"
                    step="0.1"
                    min="0"
                    disabled={isConnected}
                    {...register("batteryCapacity", { valueAsNumber: true })}
                  />
                  {errors.batteryCapacity && (
                    <p className="text-sm text-destructive">
                      {errors.batteryCapacity.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxCapacity">Maximum Capacity (kWh)</Label>
                  <Input
                    id="maxCapacity"
                    type="number"
                    step="0.1"
                    min="0"
                    disabled={isConnected}
                    {...register("maxCapacity", { valueAsNumber: true })}
                  />
                  {errors.maxCapacity && (
                    <p className="text-sm text-destructive">
                      {errors.maxCapacity.message}
                    </p>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="socketUrl">Socket.IO URL</Label>
                  <Input
                    id="socketUrl"
                    disabled={isConnected}
                    placeholder="http://localhost:3001"
                    {...register("socketUrl")}
                  />
                  {errors.socketUrl && (
                    <p className="text-sm text-destructive">
                      {errors.socketUrl.message}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isConnected}
                  >
                    Connect
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDisconnect}
                    disabled={!isConnected}
                  >
                    Disconnect
                  </Button>
                </div>
              </form>

              {isConnected && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Battery Status
                      </span>
                      <span className="font-medium">
                        {batteryPercentage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={batteryPercentage} className="h-3" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{batteryCapacity.toFixed(1)} kWh</span>
                      <span>{maxCapacity} kWh</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Console</CardTitle>
              <CardDescription>System output</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] w-full rounded border bg-black dark:bg-gray-950 p-3">
                <div className="font-mono text-xs text-green-400 space-y-0.5">
                  {messages.length === 0 ? (
                    <div className="text-gray-500">
                      $ Waiting for connection...
                    </div>
                  ) : (
                    messages.map((message, index) => (
                      <div key={index} className="leading-relaxed text-left">
                        {message}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Session QR Code</CardTitle>
              <CardDescription>Scan to connect from dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              {joinCode ? (
                <div className="space-y-4">
                  <div className="flex justify-center p-6 bg-white dark:bg-gray-50 rounded-lg">
                    <QRCode value={joinCode} size={220} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Join Code:</span>
                      <Badge
                        variant="outline"
                        className="text-base font-mono px-3 py-1"
                      >
                        {joinCode}
                      </Badge>
                    </div>
                    {sessionId && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Session ID:</span>
                        <span className="text-sm text-muted-foreground">
                          #{sessionId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      No active session
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Connect your vehicle to generate QR code
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default App;
