import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth";
import { query, transaction } from "../db";
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

    const result = await transaction(async client => {
      const totalPaise = body.items.reduce((sum, item) => sum + item.quantity * item.pricePaise, 0);
      const order = await client.query<{ id: string }>(
        `insert into orders (customer_id, restaurant_id, status, total_paise, delivery_address, delivery_lat, delivery_lng)
         values ($1, $2, 'created', $3, $4, $5, $6)
         returning id`,
        [req.user!.id, body.restaurantId, totalPaise, body.deliveryAddress, body.deliveryLat, body.deliveryLng]
      );

      for (const item of body.items) {
        await client.query(
          `insert into order_items (order_id, name, quantity, price_paise)
           values ($1, $2, $3, $4)`,
          [order.rows[0].id, item.name, item.quantity, item.pricePaise]
        );
      }

      await client.query(
        `insert into order_status_history (order_id, status, changed_by, note)
         values ($1, 'created', $2, 'Order placed')`,
        [order.rows[0].id, req.user!.id]
      );

      return { id: order.rows[0].id, totalPaise, status: "created" };
    });

    res.status(201).json(result);
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

orderRoutes.get("/available", requireRole("driver", "admin", "super_admin", "delivery_admin"), async (_req, res, next) => {
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

orderRoutes.get("/:id", async (req, res, next) => {
  try {
    const [order, items, history] = await Promise.all([
      query(
        `select * from orders
         where id = $1
           and (customer_id = $2 or driver_id = $2 or $3::text in ('admin', 'super_admin', 'delivery_admin')
             or restaurant_id in (select id from restaurants where owner_id = $2))`,
        [req.params.id, req.user!.id, req.user!.role]
      ),
      query("select * from order_items where order_id = $1 order by id", [req.params.id]),
      query("select * from order_status_history where order_id = $1 order by created_at", [req.params.id])
    ]);

    if (!order.rows[0]) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({ ...order.rows[0], items: items.rows, history: history.rows });
  } catch (error) {
    next(error);
  }
});

orderRoutes.patch("/:id", requireRole("customer", "admin", "super_admin"), async (req, res, next) => {
  try {
    const body = z.object({
      deliveryAddress: z.string().min(5).optional(),
      deliveryLat: z.number().optional(),
      deliveryLng: z.number().optional(),
      items: z.array(z.object({
        name: z.string().min(1),
        quantity: z.number().int().positive(),
        pricePaise: z.number().int().positive()
      })).min(1).optional()
    }).parse(req.body);

    const result = await transaction(async client => {
      const current = await client.query<{ id: string; customer_id: string; status: string; delivery_address: string; delivery_lat: string; delivery_lng: string }>(
        "select * from orders where id = $1 for update",
        [req.params.id]
      );
      const order = current.rows[0];

      if (!order) {
        return { statusCode: 404, body: { error: "Order not found" } };
      }
      if (req.user!.role === "customer" && order.customer_id !== req.user!.id) {
        return { statusCode: 403, body: { error: "Forbidden" } };
      }
      if (order.status !== "created") {
        return { statusCode: 409, body: { error: "Order can only be edited before restaurant confirmation" } };
      }

      const totalPaise = body.items?.reduce((sum, item) => sum + item.quantity * item.pricePaise, 0);
      const updated = await client.query(
        `update orders
         set delivery_address = coalesce($1, delivery_address),
             delivery_lat = coalesce($2, delivery_lat),
             delivery_lng = coalesce($3, delivery_lng),
             total_paise = coalesce($4, total_paise),
             updated_at = now()
         where id = $5
         returning *`,
        [body.deliveryAddress ?? null, body.deliveryLat ?? null, body.deliveryLng ?? null, totalPaise ?? null, req.params.id]
      );

      if (body.items) {
        await client.query("delete from order_items where order_id = $1", [req.params.id]);
        for (const item of body.items) {
          await client.query(
            `insert into order_items (order_id, name, quantity, price_paise)
             values ($1, $2, $3, $4)`,
            [req.params.id, item.name, item.quantity, item.pricePaise]
          );
        }
      }

      await client.query(
        `insert into order_status_history (order_id, status, changed_by, note)
         values ($1, 'created', $2, 'Order edited before confirmation')`,
        [req.params.id, req.user!.id]
      );

      return { statusCode: 200, body: updated.rows[0] };
    });

    if (result.statusCode === 200) {
      emitOrderUpdate(req.params.id, result.body);
    }
    res.status(result.statusCode).json(result.body);
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
    await recordStatusHistory(req.params.id, result.rows[0].status, req.user!.id, "Delivery partner assigned");
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

orderRoutes.post("/:id/cancel", requireRole("customer", "restaurant", "admin", "super_admin"), async (req, res, next) => {
  try {
    const body = z.object({
      reason: z.string().min(3).max(500)
    }).parse(req.body);

    const result = await transaction(async client => {
      const current = await client.query<{ id: string; customer_id: string; restaurant_id: string; status: string; created_at: string; total_paise: number }>(
        "select * from orders where id = $1 for update",
        [req.params.id]
      );
      const order = current.rows[0];

      if (!order) {
        return { statusCode: 404, body: { error: "Order not found" } };
      }

      const allowed = await canCancelOrder(order, req.user!.id, req.user!.role);
      if (!allowed.ok) {
        return { statusCode: 409, body: { error: allowed.reason } };
      }

      const updated = await client.query(
        `update orders
         set status = 'cancelled',
             cancellation_reason = $1,
             cancelled_by = $2,
             cancelled_at = now(),
             updated_at = now()
         where id = $3
         returning *`,
        [body.reason, req.user!.id, req.params.id]
      );

      await client.query(
        `insert into order_status_history (order_id, status, changed_by, note)
         values ($1, 'cancelled', $2, $3)`,
        [req.params.id, req.user!.id, body.reason]
      );

      const paidPayment = await client.query<{ id: string; provider: string; amount_paise: number }>(
        `select id, provider, amount_paise
         from payments
         where order_id = $1
           and lower(status) in ('paid', 'success', 'txn_success', 'payment_success', 'completed', 'captured')
         order by created_at desc
         limit 1`,
        [req.params.id]
      );

      if (paidPayment.rows[0]) {
        await client.query(
          `insert into refunds (order_id, payment_id, provider, amount_paise, status, reason)
           values ($1, $2, $3, $4, 'requested', $5)`,
          [req.params.id, paidPayment.rows[0].id, paidPayment.rows[0].provider, paidPayment.rows[0].amount_paise, body.reason]
        );
      }

      return { statusCode: 200, body: updated.rows[0] };
    });

    if (result.statusCode === 200) {
      emitOrderUpdate(req.params.id, result.body);
    }
    res.status(result.statusCode).json(result.body);
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
    await recordStatusHistory(req.params.id, body.status, req.user!.id, `Status changed to ${body.status}`);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

async function canCancelOrder(order: { customer_id: string; restaurant_id: string; status: string; created_at: string }, userId: string, role: string) {
  if (["cancelled", "picked_up", "delivered"].includes(order.status)) {
    return { ok: false, reason: "Order cannot be cancelled after pickup, delivery, or prior cancellation" };
  }

  if (role === "customer") {
    const ageMs = Date.now() - new Date(order.created_at).getTime();
    const withinGracePeriod = ageMs <= 10 * 60 * 1000;
    const editableStatus = order.status === "created" || (order.status === "accepted" && withinGracePeriod);
    if (order.customer_id !== userId || !editableStatus) {
      return { ok: false, reason: "Customer cancellation is allowed only before confirmation or within the accepted-order grace period" };
    }
  }

  if (role === "restaurant") {
    const owner = await query<{ id: string }>("select id from restaurants where id = $1 and owner_id = $2", [order.restaurant_id, userId]);
    if (!owner.rows[0]) {
      return { ok: false, reason: "Restaurant can cancel only its own orders before pickup" };
    }
  }

  return { ok: true };
}

async function recordStatusHistory(orderId: string, status: string, userId: string, note: string) {
  await query(
    `insert into order_status_history (order_id, status, changed_by, note)
     values ($1, $2::order_status, $3, $4)`,
    [orderId, status, userId, note]
  );
}
