import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth";
import { query } from "../db";
import { emitOrderUpdate } from "../realtime";

export const deliveryAdminRoutes = Router();

deliveryAdminRoutes.use(requireAuth, requireRole("delivery_admin", "admin", "super_admin"));

deliveryAdminRoutes.get("/drivers", async (_req, res, next) => {
  try {
    const result = await query(
      `select id, phone, email, name, created_at
       from users
       where role = 'driver'
       order by created_at desc`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

deliveryAdminRoutes.get("/orders", async (_req, res, next) => {
  try {
    const result = await query(
      `select o.*, r.name as restaurant_name, d.phone as driver_phone,
              dl.lat as last_driver_lat, dl.lng as last_driver_lng, dl.created_at as last_location_at
       from orders o
       left join restaurants r on r.id = o.restaurant_id
       left join users d on d.id = o.driver_id
       left join lateral (
         select lat, lng, created_at
         from driver_locations
         where order_id = o.id
         order by created_at desc
         limit 1
       ) dl on true
       where o.status in ('accepted', 'ready', 'picked_up')
       order by o.created_at desc`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

deliveryAdminRoutes.patch("/orders/:orderId/assign-driver", async (req, res, next) => {
  try {
    const body = z.object({ driverId: z.string().uuid() }).parse(req.body);
    const result = await query(
      `update orders
       set driver_id = $1, updated_at = now()
       where id = $2
       returning *`,
      [body.driverId, req.params.orderId]
    );
    emitOrderUpdate(req.params.orderId, result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
