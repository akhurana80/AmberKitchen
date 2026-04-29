import http from "http";
import express, { ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config";
import { authRoutes } from "./routes/auth.routes";
import { orderRoutes } from "./routes/order.routes";
import { paymentRoutes } from "./routes/payment.routes";
import { trackingRoutes } from "./routes/tracking.routes";
import { notificationRoutes } from "./routes/notification.routes";
import { adminRoutes } from "./routes/admin.routes";
import { restaurantRoutes } from "./routes/restaurant.routes";
import { deliveryAdminRoutes } from "./routes/delivery-admin.routes";
import { driverOnboardingRoutes } from "./routes/driver-onboarding.routes";
import { attachRealtime } from "./realtime";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_, res) => {
  res.json({ ok: true, service: "amberkitchen-backend" });
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
