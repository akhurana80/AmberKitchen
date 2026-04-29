import { Server } from "socket.io";
import { Server as HttpServer } from "http";

let io: Server | undefined;

export function attachRealtime(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: "*"
    }
  });

  io.on("connection", socket => {
    socket.on("order:join", orderId => {
      socket.join(`order:${orderId}`);
    });

    socket.on("driver:join", driverId => {
      socket.join(`driver:${driverId}`);
    });
  });

  return io;
}

export function emitOrderUpdate(orderId: string, payload: unknown) {
  io?.to(`order:${orderId}`).emit("order:update", payload);
}

export function emitDriverLocation(orderId: string, payload: unknown) {
  io?.to(`order:${orderId}`).emit("driver:location", payload);
}
