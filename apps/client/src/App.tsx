import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { ScrollArea } from "./components/ui/scroll-area";
import QRCode from "react-qr-code";
import "./App.css";

const formSchema = z.object({
  batteryCapacity: z.number().min(0),
  maxCapacity: z.number().min(0),
  targetSOC: z.number().min(0).max(100),
  socketUrl: z.string().url(),
});

type FormData = z.infer<typeof formSchema>;

// Event data types
interface PowerUpdateData {
  kwh: number;
  currentCapacity: number;
  maxCapacity: number;
  currentSOC: number;
  timestamp: string;
}

interface HandshakeSuccessData {
  sessionId: number;
  channelId: string;
  joinCode: string;
  message: string;
  timestamp: string;
}

interface ConnectionRejectedData {
  message: string;
  timestamp: string;
}

interface ChargingCompleteData {
  message: string;
  finalCapacity: number;
  finalSOC: number;
  timestamp: string;
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [joinCode, setJoinCode] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      batteryCapacity: 100,
      maxCapacity: 200,
      targetSOC: 80,
      socketUrl: "http://localhost:3001",
    },
  });

  const addMessage = (message: string) => {
    setMessages((prev) => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  // Set up socket event listeners when socket changes
  useEffect(() => {
    if (!socket) return;

    function onConnect() {
      setIsConnected(true);
      addMessage(`Connected to server`);
    }

    function onDisconnect() {
      setIsConnected(false);
      addMessage(`Disconnected from server`);
    }

    function onPowerUpdate(data: PowerUpdateData) {
      setValue("batteryCapacity", data.currentCapacity);
      addMessage(
        `Power update: ${data.kwh} kWh charged, Current: ${data.currentCapacity}/${data.maxCapacity} kWh (${data.currentSOC.toFixed(1)}%)`
      );
    }

    function onHandshakeSuccess(data: HandshakeSuccessData) {
      setJoinCode(data.joinCode);
      addMessage(`Handshake success: ${data.message}`);
      addMessage(`Session ID: ${data.sessionId}`);
      addMessage(`Channel ID: ${data.channelId}`);
      addMessage(`Join Code: ${data.joinCode}`);
    }

    function onConnectionRejected(data: ConnectionRejectedData) {
      addMessage(`Connection rejected: ${data.message}`);
      setIsConnected(false);
    }

    function onChargingComplete(data: ChargingCompleteData) {
      addMessage(`Charging complete: ${data.message}`);
    }

    // Register event listeners
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("power_update", onPowerUpdate);
    socket.on("handshake_success", onHandshakeSuccess);
    socket.on("connection_rejected", onConnectionRejected);
    socket.on("charging_complete", onChargingComplete);

    // Cleanup function to remove event listeners
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("power_update", onPowerUpdate);
      socket.off("handshake_success", onHandshakeSuccess);
      socket.off("connection_rejected", onConnectionRejected);
      socket.off("charging_complete", onChargingComplete);
    };
  }, [socket, setValue]);

  const onSubmit = (data: FormData) => {
    // Disconnect existing socket if connected
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }

    // Create new socket instance with autoConnect: false
    const socketInstance = io(data.socketUrl, {
      autoConnect: false,
    });

    setSocket(socketInstance);

    // Connect manually
    socketInstance.connect();

    // Send configuration after connection is established
    socketInstance.once("connect", () => {
      socketInstance.emit("configure_simulation", {
        batteryCapacity: data.batteryCapacity,
        maxCapacity: data.maxCapacity,
        targetSOC: data.targetSOC,
        timestamp: new Date().toISOString(),
      });
      addMessage(
        `Sent configuration: ${data.batteryCapacity} kWh / ${data.maxCapacity} kWh max / ${data.targetSOC}% target SOC`
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
      addMessage("Disconnected manually");
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-7xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Giả Lập Xe Hơi</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              id="main-form"
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-6"
            >
              <div className="space-y-3">
                <Label htmlFor="batteryCapacity" className="text-lg">
                  Battery Capacity (kWh)
                </Label>
                <Input
                  id="batteryCapacity"
                  type="number"
                  min="0"
                  disabled={isConnected}
                  className="text-lg h-12"
                  {...register("batteryCapacity", { valueAsNumber: true })}
                />
                {errors.batteryCapacity && (
                  <p className="text-sm text-destructive">
                    {errors.batteryCapacity.message}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="maxCapacity" className="text-lg">
                  Maximum Capacity (kWh)
                </Label>
                <Input
                  id="maxCapacity"
                  type="number"
                  min="0"
                  disabled={isConnected}
                  className="text-lg h-12"
                  {...register("maxCapacity", { valueAsNumber: true })}
                />
                {errors.maxCapacity && (
                  <p className="text-sm text-destructive">
                    {errors.maxCapacity.message}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="targetSOC" className="text-lg">
                  Target SOC (%)
                </Label>
                <Input
                  id="targetSOC"
                  type="number"
                  min="0"
                  max="100"
                  disabled={isConnected}
                  className="text-lg h-12"
                  {...register("targetSOC", { valueAsNumber: true })}
                />
                {errors.targetSOC && (
                  <p className="text-sm text-destructive">
                    {errors.targetSOC.message}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="socketUrl" className="text-lg">
                  Socket.IO URL
                </Label>
                <Input
                  id="socketUrl"
                  disabled={isConnected}
                  placeholder="http://localhost:3001"
                  className="text-lg h-12"
                  {...register("socketUrl")}
                />
                {errors.socketUrl && (
                  <p className="text-sm text-destructive">
                    {errors.socketUrl.message}
                  </p>
                )}
              </div>

              <div className="flex gap-4">
                <Button type="submit" className="text-lg h-12 px-6">
                  Connect
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDisconnect}
                  className="text-lg h-12 px-6"
                >
                  Disconnect
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Console</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] w-full rounded border p-6">
              <div className="font-mono text-base space-y-2">
                {messages.length === 0 ? (
                  <p className="text-muted-foreground text-lg">
                    No messages received yet
                  </p>
                ) : (
                  messages.map((message, index) => (
                    <div key={index} className="text-sm">
                      {message}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {joinCode && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Join Code QR</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <QRCode value={joinCode} size={256} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default App;
