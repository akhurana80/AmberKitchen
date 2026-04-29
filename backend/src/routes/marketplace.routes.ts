import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth";
import { query } from "../db";

export const marketplaceRoutes = Router();

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

marketplaceRoutes.use(requireAuth);

marketplaceRoutes.get("/zones", async (_req, res, next) => {
  try {
    const result = await query("select * from zones order by city, name");
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

marketplaceRoutes.post("/zones", requireRole("admin", "super_admin", "delivery_admin"), async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(2),
      city: z.string().min(2),
      centerLat: z.number(),
      centerLng: z.number(),
      radiusKm: z.number().positive().default(3),
      slaMinutes: z.number().int().positive().default(25),
      surgeMultiplier: z.number().positive().default(1)
    }).parse(req.body);
    const result = await query(
      `insert into zones (name, city, center_lat, center_lng, radius_km, sla_minutes, surge_multiplier)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning *`,
      [body.name, body.city, body.centerLat, body.centerLng, body.radiusKm, body.slaMinutes, body.surgeMultiplier]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

marketplaceRoutes.get("/offers", async (_req, res, next) => {
  try {
    const result = await query(
      `select * from offers
       where is_active = true
         and starts_at <= now()
         and (ends_at is null or ends_at >= now())
       order by created_at desc`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

marketplaceRoutes.post("/offers", requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const body = z.object({
      code: z.string().min(3),
      title: z.string().min(2),
      description: z.string().optional(),
      discountType: z.enum(["flat", "percent"]),
      discountValue: z.number().int().positive(),
      minOrderPaise: z.number().int().nonnegative().default(0)
    }).parse(req.body);
    const result = await query(
      `insert into offers (code, title, description, discount_type, discount_value, min_order_paise)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [body.code.toUpperCase(), body.title, body.description ?? null, body.discountType, body.discountValue, body.minOrderPaise]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

marketplaceRoutes.post("/restaurants/:restaurantId/reviews", requireRole("customer", "admin", "super_admin"), async (req, res, next) => {
  try {
    const body = z.object({
      orderId: z.string().uuid().optional(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().optional()
    }).parse(req.body);
    const result = await query(
      `insert into restaurant_reviews (restaurant_id, customer_id, order_id, rating, comment)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [routeParam(req.params.restaurantId), req.user!.id, body.orderId ?? null, body.rating, body.comment ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

marketplaceRoutes.get("/restaurants/:restaurantId/reviews", async (req, res, next) => {
  try {
    const result = await query(
      `select rr.*, u.name as customer_name
       from restaurant_reviews rr
       left join users u on u.id = rr.customer_id
       where rr.restaurant_id = $1
       order by rr.created_at desc
       limit 100`,
      [routeParam(req.params.restaurantId)]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

marketplaceRoutes.post("/support/tickets", async (req, res, next) => {
  try {
    const body = z.object({
      orderId: z.string().uuid().optional(),
      category: z.string().min(2),
      subject: z.string().min(3),
      message: z.string().min(5)
    }).parse(req.body);
    const result = await query(
      `insert into support_tickets (user_id, order_id, category, subject, message)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [req.user!.id, body.orderId ?? null, body.category, body.subject, body.message]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

marketplaceRoutes.get("/support/tickets", requireRole("admin", "super_admin"), async (_req, res, next) => {
  try {
    const result = await query("select * from support_tickets order by created_at desc limit 200");
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

marketplaceRoutes.post("/campaigns", requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(2),
      zoneId: z.string().uuid().optional(),
      channel: z.enum(["push", "email", "whatsapp", "ads"]),
      budgetPaise: z.number().int().nonnegative().default(0),
      aiCreative: z.string().optional()
    }).parse(req.body);
    const result = await query(
      `insert into campaigns (name, zone_id, channel, budget_paise, ai_creative, status)
       values ($1, $2, $3, $4, $5, 'active')
       returning *`,
      [body.name, body.zoneId ?? null, body.channel, body.budgetPaise, body.aiCreative ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

marketplaceRoutes.get("/campaigns", requireRole("admin", "super_admin"), async (_req, res, next) => {
  try {
    const result = await query("select * from campaigns order by created_at desc limit 100");
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

marketplaceRoutes.post("/driver-incentives", requireRole("delivery_admin", "admin", "super_admin"), async (req, res, next) => {
  try {
    const body = z.object({
      driverId: z.string().uuid().optional(),
      title: z.string().min(2),
      targetDeliveries: z.number().int().positive(),
      rewardPaise: z.number().int().positive()
    }).parse(req.body);
    const result = await query(
      `insert into driver_incentives (driver_id, title, target_deliveries, reward_paise)
       values ($1, $2, $3, $4)
       returning *`,
      [body.driverId ?? null, body.title, body.targetDeliveries, body.rewardPaise]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

marketplaceRoutes.get("/driver-incentives", requireRole("driver", "delivery_admin", "admin", "super_admin"), async (req, res, next) => {
  try {
    const result = await query(
      `select * from driver_incentives
       where driver_id is null or driver_id = $1 or $2::text in ('delivery_admin', 'admin', 'super_admin')
       order by created_at desc`,
      [req.user!.id, req.user!.role]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

marketplaceRoutes.post("/integrations/events", requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const body = z.object({
      provider: z.enum(["azure-email", "azure-whatsapp", "azure-blob", "azure-ocr", "azure-face", "mapbox", "openstreetmap"]),
      eventType: z.string().min(2),
      payload: z.record(z.unknown()).optional()
    }).parse(req.body);
    const result = await query(
      `insert into integration_events (provider, event_type, status, payload)
       values ($1, $2, 'queued', $3)
       returning *`,
      [body.provider, body.eventType, body.payload ?? {}]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
