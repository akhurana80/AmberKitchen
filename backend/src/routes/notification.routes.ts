import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth";
import { saveDeviceToken, sendPushToUser } from "../services/push.service";

export const notificationRoutes = Router();

notificationRoutes.use(requireAuth);

notificationRoutes.post("/device-token", async (req, res, next) => {
  try {
    const body = z.object({
      token: z.string().min(20),
      platform: z.enum(["ios", "android", "web"])
    }).parse(req.body);
    await saveDeviceToken(req.user!.id, body.token, body.platform);
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

notificationRoutes.post("/test", async (req, res, next) => {
  try {
    res.json(await sendPushToUser(req.user!.id, "AmberKitchen", "Push notifications are configured."));
  } catch (error) {
    next(error);
  }
});
