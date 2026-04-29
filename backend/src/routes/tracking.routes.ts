import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth";
import { query } from "../db";
import { emitDriverLocation } from "../realtime";

export const trackingRoutes = Router();

trackingRoutes.use(requireAuth);

trackingRoutes.post("/orders/:orderId/location", requireRole("driver", "admin"), async (req, res, next) => {
  try {
    const body = z.object({
      lat: z.number(),
      lng: z.number(),
      heading: z.number().optional(),
      speed: z.number().optional()
    }).parse(req.body);

    const result = await query(
      `insert into driver_locations (order_id, driver_id, lat, lng, heading, speed)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [req.params.orderId, req.user!.id, body.lat, body.lng, body.heading ?? null, body.speed ?? null]
    );

    emitDriverLocation(req.params.orderId, result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

trackingRoutes.get("/orders/:orderId/location", async (req, res, next) => {
  try {
    const result = await query(
      `select * from driver_locations
       where order_id = $1
       order by created_at desc
       limit 1`,
      [req.params.orderId]
    );
    res.json(result.rows[0] ?? null);
  } catch (error) {
    next(error);
  }
});
