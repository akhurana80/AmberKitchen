import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth";
import { query } from "../db";
import { emitOrderUpdate } from "../realtime";

export const restaurantRoutes = Router();

restaurantRoutes.use(requireAuth, requireRole("restaurant", "admin", "super_admin"));

restaurantRoutes.post("/", async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(2),
      address: z.string().min(5),
      contactName: z.string().optional(),
      contactPhone: z.string().optional(),
      cuisineType: z.string().optional(),
      fssaiLicense: z.string().optional(),
      gstNumber: z.string().optional(),
      bankAccountLast4: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional()
    }).parse(req.body);

    const result = await query(
      `insert into restaurants (
         owner_id, name, address, contact_name, contact_phone, cuisine_type,
         fssai_license, gst_number, bank_account_last4, onboarding_status,
         approval_status, lat, lng
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'submitted', 'pending', $10, $11)
       returning *`,
      [
        req.user!.id,
        body.name,
        body.address,
        body.contactName ?? null,
        body.contactPhone ?? null,
        body.cuisineType ?? null,
        body.fssaiLicense ?? null,
        body.gstNumber ?? null,
        body.bankAccountLast4 ?? null,
        body.lat ?? null,
        body.lng ?? null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.post("/onboarding", async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(2),
      address: z.string().min(5),
      contactName: z.string().min(2),
      contactPhone: z.string().min(8),
      cuisineType: z.string().min(2),
      fssaiLicense: z.string().optional(),
      gstNumber: z.string().optional(),
      bankAccountLast4: z.string().length(4).optional(),
      lat: z.number().optional(),
      lng: z.number().optional()
    }).parse(req.body);

    const result = await query(
      `insert into restaurants (
         owner_id, name, address, contact_name, contact_phone, cuisine_type,
         fssai_license, gst_number, bank_account_last4, onboarding_status,
         approval_status, lat, lng
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'submitted', 'pending', $10, $11)
       returning *`,
      [
        req.user!.id,
        body.name,
        body.address,
        body.contactName,
        body.contactPhone,
        body.cuisineType,
        body.fssaiLicense ?? null,
        body.gstNumber ?? null,
        body.bankAccountLast4 ?? null,
        body.lat ?? null,
        body.lng ?? null
      ]
    );

    res.status(201).json({
      ...result.rows[0],
      nextStep: "Restaurant submitted for Super Admin approval"
    });
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.get("/mine", async (req, res, next) => {
  try {
    const result = await query("select * from restaurants where owner_id = $1 order by created_at desc", [req.user!.id]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.post("/:restaurantId/menu", async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(2),
      description: z.string().optional(),
      pricePaise: z.number().int().positive(),
      isAvailable: z.boolean().default(true)
    }).parse(req.body);

    const result = await query(
      `insert into menu_items (restaurant_id, name, description, price_paise, is_available)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [req.params.restaurantId, body.name, body.description ?? null, body.pricePaise, body.isAvailable]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.get("/:restaurantId/menu", async (req, res, next) => {
  try {
    const result = await query("select * from menu_items where restaurant_id = $1 order by created_at desc", [req.params.restaurantId]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.patch("/menu/:itemId", async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      pricePaise: z.number().int().positive().optional(),
      isAvailable: z.boolean().optional()
    }).parse(req.body);

    const result = await query(
      `update menu_items
       set name = coalesce($1, name),
           description = coalesce($2, description),
           price_paise = coalesce($3, price_paise),
           is_available = coalesce($4, is_available),
           updated_at = now()
       where id = $5
       returning *`,
      [body.name ?? null, body.description ?? null, body.pricePaise ?? null, body.isAvailable ?? null, req.params.itemId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.get("/:restaurantId/orders", async (req, res, next) => {
  try {
    const result = await query(
      `select * from orders
       where restaurant_id = $1
       order by created_at desc
       limit 100`,
      [req.params.restaurantId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.patch("/orders/:orderId/decision", async (req, res, next) => {
  try {
    const body = z.object({
      decision: z.enum(["accepted", "cancelled"])
    }).parse(req.body);

    const result = await query(
      `update orders set status = $1, updated_at = now()
       where id = $2
       returning *`,
      [body.decision, req.params.orderId]
    );
    await query(
      `insert into order_status_history (order_id, status, changed_by, note)
       values ($1, $2::order_status, $3, $4)`,
      [req.params.orderId, body.decision, req.user!.id, `Restaurant ${body.decision} order`]
    );
    emitOrderUpdate(req.params.orderId, result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

restaurantRoutes.get("/:restaurantId/earnings", async (req, res, next) => {
  try {
    const result = await query(
      `select count(*) as orders,
              coalesce(sum(total_paise), 0) as gross_paise,
              coalesce(sum(total_paise) * 0.82, 0)::integer as estimated_payout_paise
       from orders
       where restaurant_id = $1
         and status = 'delivered'`,
      [req.params.restaurantId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
