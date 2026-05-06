import http from "http";
import { Socket } from "net";
import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { db, query } from "./db";
import { authRoutes } from "./routes/auth.routes";
import { orderRoutes } from "./routes/order.routes";
import { paymentRoutes } from "./routes/payment.routes";
import { trackingRoutes } from "./routes/tracking.routes";
import { notificationRoutes } from "./routes/notification.routes";
import { adminRoutes } from "./routes/admin.routes";
import { restaurantRoutes } from "./routes/restaurant.routes";
import { deliveryAdminRoutes } from "./routes/delivery-admin.routes";
import { driverOnboardingRoutes } from "./routes/driver-onboarding.routes";
import { walletRoutes } from "./routes/wallet.routes";
import { operationsRoutes } from "./routes/operations.routes";
import { marketplaceRoutes } from "./routes/marketplace.routes";
import { integrationRoutes } from "./routes/integration.routes";
import { auditLog, rateLimit, requestId } from "./middleware/security";
import { attachRealtime } from "./realtime";

const app = express();

app.set("trust proxy", 1);
app.use(requestId);
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS origin is not allowed"));
  }
}));
app.use(rateLimit);
app.use(express.json({
  limit: "10mb",
  verify: (req, _res, buf) => {
    (req as express.Request).rawBody = Buffer.from(buf);
  }
}));
app.use(auditLog);

app.get("/health", async (_req, res) => {
  try {
    await query("select 1");
    res.json({
      ok: true,
      service: "amberkitchen-backend",
      database: "ok",
      azure: {
        storageConfigured: Boolean(config.azure.storageConnectionString),
        communicationConfigured: Boolean(config.azure.communicationConnectionString),
        monitoringConfigured: Boolean(config.azure.applicationInsightsConnectionString)
      }
    });
  } catch {
    res.status(503).json({ ok: false, service: "amberkitchen-backend", database: "error" });
  }
});

function registerRoutes(prefix: string) {
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/orders`, orderRoutes);
  app.use(`${prefix}/payments`, paymentRoutes);
  app.use(`${prefix}/tracking`, trackingRoutes);
  app.use(`${prefix}/notifications`, notificationRoutes);
  app.use(`${prefix}/admin`, adminRoutes);
  app.use(`${prefix}/restaurants`, restaurantRoutes);
  app.use(`${prefix}/delivery-admin`, deliveryAdminRoutes);
  app.use(`${prefix}/driver-onboarding`, driverOnboardingRoutes);
  app.use(`${prefix}/wallet`, walletRoutes);
  app.use(`${prefix}/operations`, operationsRoutes);
  app.use(`${prefix}/marketplace`, marketplaceRoutes);
  app.use(`${prefix}/integrations`, integrationRoutes);
}

registerRoutes("/api");
registerRoutes("/api/v1");

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const status = error.name === "ZodError" ? 400 : 500;
  if (status === 500) {
    console.error("[ERROR]", error?.message, error?.stack?.split("\n")[1]);
  }
  res.status(status).json({
    error: status === 500 ? "Internal server error" : "Validation error",
    details: status === 500 ? undefined : error.errors
  });
};

app.use(errorHandler);

const server = http.createServer(app);
attachRealtime(server);

const sockets = new Set<Socket>();
server.on("connection", socket => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
});

server.listen(config.port, () => {
  console.log(JSON.stringify({ level: "info", service: "amberkitchen-backend", port: config.port, message: "listening" }));
});

function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", service: "amberkitchen-backend", signal, message: "shutdown_started" }));
  server.close(async () => {
    await db.end();
    console.log(JSON.stringify({ level: "info", service: "amberkitchen-backend", signal, message: "shutdown_complete" }));
    process.exit(0);
  });

  setTimeout(() => {
    for (const socket of sockets) {
      socket.destroy();
    }
    console.error(JSON.stringify({ level: "error", service: "amberkitchen-backend", signal, message: "shutdown_forced" }));
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
