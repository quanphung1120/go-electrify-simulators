import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { ScrollArea } from "./components/ui/scroll-area";
import { useSocket } from "./hooks/useSocket";
import "./App.css";

const formSchema = z.object({
  batteryCapacity: z.number().min(0),
  maxCapacity: z.number().min(0),
  targetSOC: z.number().min(0).max(100),
  socketUrl: z.string().url(),
});

type FormData = z.infer<typeof formSchema>;

function App() {
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

  const { isConnected, messages, connect, disconnect } = useSocket(
    setValue as any
  );

  const onSubmit = (data: FormData) => {
    connect(data);
  };

  const handleDisconnect = () => {
    disconnect();
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Simulator Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              id="main-form"
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="batteryCapacity">Battery Capacity (kWh)</Label>
                <Input
                  id="batteryCapacity"
                  type="number"
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

              <div className="space-y-2">
                <Label htmlFor="targetSOC">Target SOC (%)</Label>
                <Input
                  id="targetSOC"
                  type="number"
                  min="0"
                  max="100"
                  disabled={isConnected}
                  {...register("targetSOC", { valueAsNumber: true })}
                />
                {errors.targetSOC && (
                  <p className="text-sm text-destructive">
                    {errors.targetSOC.message}
                  </p>
                )}
              </div>

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

              <div className="flex gap-2">
                <Button type="submit">Connect</Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDisconnect}
                >
                  Disconnect
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Socket.IO Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96 w-full rounded border p-4">
              <div className="font-mono text-sm space-y-1">
                {messages.length === 0 ? (
                  <p className="text-muted-foreground">
                    No messages received yet
                  </p>
                ) : (
                  messages.map((message, index) => (
                    <div key={index} className="text-xs">
                      {message}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default App;
