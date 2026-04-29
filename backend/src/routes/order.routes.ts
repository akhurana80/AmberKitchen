import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth";
import { query } from "../db";
import { emitOrderUpdate } from "../realtime";

export const orderRoutes = Router();

orderRoutes.use(requireAuth);

orderRoutes.post("/", requireRole("customer", "admin"), async (req, res, next) => {
  try {
    const body = z.object({
      restaurantId: z.string().uuid(),
      deliveryAddress: z.string().min(5),
      deliveryLat: z.number(),
      deliveryLng: z.number(),
      items: z.array(z.object({
        name: z.string().min(1),
        quantity: z.number().int().positive(),
        pricePaise: z.number().int().positive()
      })).min(1)
    }).parse(req.body);

    const totalPaise = body.items.reduce((sum, item) => sum + item.quantity * item.pricePaise, 0);
    const order = await query<{ id: string }>(
      `insert into orders (customer_id, restaurant_id, status, total_paise, delivery_address, delivery_lat, delivery_lng)
       values ($1, $2, 'created', $3, $4, $5, $6)
       returning id`,
      [req.user!.id, body.restaurantId, totalPaise, body.deliveryAddress, body.deliveryLat, body.deliveryLng]
    );

    for (const item of body.items) {
      await query(
        `insert into order_items (order_id, name, quantity, price_paise)
         values ($1, $2, $3, $4)`,
        [order.rows[0].id, item.name, item.quantity, item.pricePaise]
      );
    }

    res.status(201).json({ id: order.rows[0].id, totalPaise, status: "created" });
  } catch (error) {
    next(error);
  }
});

orderRoutes.get("/", async (req, res, next) => {
  try {
    const result = await query(
      `select * from orders
       where customer_id = $1 or driver_id = $1 or restaurant_id in (
         select id from restaurants where owner_id = $1
       )
       order by created_at desc`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

orderRoutes.get("/available", requireRole("driver", "admin"), async (_req, res, next) => {
  try {
    const result = await query(
      `select o.id, o.status, o.total_paise, o.delivery_address, o.delivery_lat, o.delivery_lng,
              r.name as restaurant_name, r.address as restaurant_address, r.lat as restaurant_lat, r.lng as restaurant_lng
       from orders o
       left join restaurants r on r.id = o.restaurant_id
       where o.driver_id is null
         and o.status in ('accepted', 'ready')
       order by o.created_at asc
       limit 25`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

orderRoutes.patch("/:id/assign", requireRole("driver", "admin"), async (req, res, next) => {
  try {
    const result = await query(
      `update orders
       set driver_id = $1,
           status = case when status = 'ready' then status else 'accepted' end,
           updated_at = now()
       where id = $2
         and (driver_id is null or driver_id = $1)
       returning *`,
      [req.user!.id, req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(409).json({ error: "Order is already assigned to another delivery partner" });
    }

    emitOrderUpdate(req.params.id, result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

orderRoutes.patch("/:id/status", requireRole("restaurant", "driver", "admin"), async (req, res, next) => {
  try {
    const body = z.object({
      status: z.enum(["accepted", "preparing", "ready", "picked_up", "delivered", "cancelled"])
    }).parse(req.body);

    const result = await query(
      `update orders set status = $1, updated_at = now()
       where id = $2
         and ($3::text <> 'driver' or driver_id = $4)
       returning *`,
      [body.status, req.params.id, req.user!.role, req.user!.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Order not found or not assigned to this delivery partner" });
    }

    emitOrderUpdate(req.params.id, result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
