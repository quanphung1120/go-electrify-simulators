import { Server, Socket } from "socket.io";
import { SharedState } from "./state";
import { registerConnectionHandlers, registerCarHandlers } from "./handlers";

const onConnection = async (
  io: Server,
  socket: Socket,
  state: SharedState
): Promise<void> => {
  await registerConnectionHandlers(io, socket, state);
  registerCarHandlers(io, socket, state);
};

export function setupSocketHandlers(io: Server, state: SharedState): void {
  io.on("connection", (socket: Socket) => {
    onConnection(io, socket, state);
  });
}
