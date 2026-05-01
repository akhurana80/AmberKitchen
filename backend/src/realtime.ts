import jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import type { AuthUser } from "./auth";
import { config } from "./config";
import { query } from "./db";

let io: Server | undefined;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function socketToken(socket: Socket) {
  const auth = socket.handshake.auth as { token?: string } | undefined;
  const header = socket.handshake.headers.authorization;
  if (auth?.token) {
    return auth.token;
  }
  return header?.startsWith("Bearer ") ? header.slice(7) : undefined;
}

function isOperationsRole(role: string) {
  return ["admin", "super_admin", "delivery_admin"].includes(role);
}

async function canAccessOrder(user: AuthUser, orderId: string) {
  if (!uuidPattern.test(orderId)) {
    return false;
  }
  const result = await query(
    `select id
     from orders
     where id = $1
       and (customer_id = $2 or driver_id = $2 or $3::text in ('admin', 'super_admin', 'delivery_admin')
         or restaurant_id in (select id from restaurants where owner_id = $2))
     limit 1`,
    [orderId, user.id, user.role]
  );
  return Boolean(result.rows[0]);
}

async function joinOrderRoom(socket: Socket, rawOrderId: unknown, ack?: (payload: unknown) => void) {
  const user = socket.data.user as AuthUser;
  const orderId = String(rawOrderId ?? "");
  if (!(await canAccessOrder(user, orderId))) {
    const payload = { ok: false, orderId, message: "Not allowed to subscribe to this order" };
    socket.emit("tracking:error", payload);
    ack?.(payload);
    return;
  }
  socket.join(`order:${orderId}`);
  const payload = { ok: true, orderId };
  socket.emit("tracking:joined", payload);
  ack?.(payload);
}

export function attachRealtime(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: config.corsOrigins
    }
  });

  io.use((socket, next) => {
    const token = socketToken(socket);
    if (!token) {
      return next(new Error("Missing realtime auth token"));
    }
    try {
      socket.data.user = jwt.verify(token, config.jwtSecret) as AuthUser;
      return next();
    } catch {
      return next(new Error("Invalid realtime auth token"));
    }
  });

  io.on("connection", socket => {
    socket.on("order:join", (orderId, ack) => {
      void joinOrderRoom(socket, orderId, typeof ack === "function" ? ack : undefined);
    });

    socket.on("join-order", (orderId, ack) => {
      void joinOrderRoom(socket, orderId, typeof ack === "function" ? ack : undefined);
    });

    socket.on("driver:join", driverId => {
      const user = socket.data.user as AuthUser;
      if (user.id === driverId || isOperationsRole(user.role)) {
        socket.join(`driver:${driverId}`);
      }
    });
  });

  return io;
}

export function emitOrderUpdate(orderId: string, payload: unknown) {
  io?.to(`order:${orderId}`).emit("order:update", payload);
}

export function emitDriverLocation(orderId: string, payload: unknown) {
  io?.to(`order:${orderId}`).emit("driver:location", payload);
  io?.to(`order:${orderId}`).emit("tracking:location", payload);
}
