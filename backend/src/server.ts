import http from "http";
import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { query } from "./db";
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

app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/delivery-admin", deliveryAdminRoutes);
app.use("/api/driver-onboarding", driverOnboardingRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/operations", operationsRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use("/api/integrations", integrationRoutes);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const status = error.name === "ZodError" ? 400 : 500;
  res.status(status).json({
    error: status === 500 ? "Internal server error" : "Validation error",
    details: status === 500 ? undefined : error.errors
  });
};

app.use(errorHandler);

const server = http.createServer(app);
attachRealtime(server);

server.listen(config.port, () => {
  console.log(`AmberKitchen backend listening on ${config.port}`);
});
