import { Router } from "express";
import { createHash } from "crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth";
import { query, transaction } from "../db";
import { emitOrderUpdate } from "../realtime";

export const orderRoutes = Router();

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

function hashRequestBody(body: unknown) {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

const cartModifierInput = z.object({
  name: z.string().min(1).max(120),
  pricePaise: z.number().int().nonnegative().default(0)
});

const orderItemInput = z.object({
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  pricePaise: z.number().int().positive(),
  modifiers: z.array(cartModifierInput).max(12).default([])
});

type OrderItemInput = z.infer<typeof orderItemInput>;

type PricingBreakdown = {
  subtotalPaise: number;
  taxPaise: number;
  platformFeePaise: number;
  deliveryFeePaise: number;
  discountPaise: number;
  totalPaise: number;
  couponCode: string | null;
};

type OfferRow = {
  code: string;
  discount_type: "flat" | "percent";
  discount_value: number;
  min_order_paise: number;
};

function itemUnitPricePaise(item: OrderItemInput) {
  return item.pricePaise + item.modifiers.reduce((sum, modifier) => sum + modifier.pricePaise, 0);
}

async function priceOrder(client: PoolClient, items: OrderItemInput[], couponCode?: string): Promise<PricingBreakdown | { error: string }> {
  const subtotalPaise = items.reduce((sum, item) => sum + item.quantity * itemUnitPricePaise(item), 0);
  const taxPaise = Math.round(subtotalPaise * 0.05);
  const platformFeePaise = subtotalPaise >= 19900 ? 900 : 0;
  const deliveryFeePaise = subtotalPaise >= 49900 ? 0 : 3900;
  const normalizedCoupon = couponCode?.trim().toUpperCase() || null;
  let discountPaise = 0;

  if (normalizedCoupon) {
    const offer = await client.query<OfferRow>(
      `select code, discount_type, discount_value, min_order_paise
       from offers
       where code = $1
         and is_active = true
         and starts_at <= now()
         and (ends_at is null or ends_at >= now())`,
      [normalizedCoupon]
    );
    const activeOffer = offer.rows[0];
    if (!activeOffer) {
      return { error: "Coupon is not active or does not exist" };
    }
    if (subtotalPaise < Number(activeOffer.min_order_paise)) {
      return { error: `Coupon requires a minimum order of ${Number(activeOffer.min_order_paise)} paise` };
    }
    discountPaise = activeOffer.discount_type === "flat"
      ? Number(activeOffer.discount_value)
      : Math.round(subtotalPaise * Number(activeOffer.discount_value) / 100);
  }

  const totalBeforeDiscount = subtotalPaise + taxPaise + platformFeePaise + deliveryFeePaise;
  discountPaise = Math.min(discountPaise, totalBeforeDiscount);
  return {
    subtotalPaise,
    taxPaise,
    platformFeePaise,
    deliveryFeePaise,
    discountPaise,
    totalPaise: totalBeforeDiscount - discountPaise,
    couponCode: normalizedCoupon
  };
}

async function insertOrderItems(client: PoolClient, orderId: string, items: OrderItemInput[]) {
  for (const item of items) {
    await client.query(
      `insert into order_items (order_id, name, quantity, price_paise, modifiers)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [orderId, item.name, item.quantity, item.pricePaise, JSON.stringify(item.modifiers)]
    );
  }
}

orderRoutes.use(requireAuth);

orderRoutes.post("/", requireRole("customer", "admin"), async (req, res, next) => {
  try {
    const body = z.object({
      restaurantId: z.string().uuid(),
      deliveryAddress: z.string().min(5),
      deliveryLat: z.number(),
      deliveryLng: z.number(),
      couponCode: z.string().trim().min(2).max(32).optional(),
      items: z.array(orderItemInput).min(1)
    }).parse(req.body);

    const idempotencyKey = req.header("idempotency-key");
    const requestHash = hashRequestBody(body);
    if (idempotencyKey) {
      const existing = await query<{ request_hash: string; response_status: number; response_body: unknown }>(
        `select request_hash, response_status, response_body
         from idempotency_keys
         where key = $1 and user_id = $2 and scope = 'order:create'`,
        [idempotencyKey, req.user!.id]
      );
      if (existing.rows[0]) {
        if (existing.rows[0].request_hash !== requestHash) {
          return res.status(409).json({ error: "Idempotency key was already used with a different order request" });
        }
        return res.status(existing.rows[0].response_status).json(existing.rows[0].response_body);
      }
    }

    const result = await transaction(async client => {
      const pricing = await priceOrder(client, body.items, body.couponCode);
      if ("error" in pricing) {
        return { statusCode: 400, body: { error: pricing.error } };
      }
      const order = await client.query<{ id: string; estimated_delivery_at: string }>(
        `insert into orders (
           customer_id, restaurant_id, status, total_paise, subtotal_paise,
           tax_paise, platform_fee_paise, delivery_fee_paise, discount_paise,
           coupon_code, delivery_address, delivery_lat, delivery_lng,
           auto_cancel_at, estimated_delivery_at
         )
         values ($1, $2, 'created', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now() + interval '10 minutes', now() + interval '45 minutes')
         returning id, estimated_delivery_at`,
        [
          req.user!.id,
          body.restaurantId,
          pricing.totalPaise,
          pricing.subtotalPaise,
          pricing.taxPaise,
          pricing.platformFeePaise,
          pricing.deliveryFeePaise,
          pricing.discountPaise,
          pricing.couponCode,
          body.deliveryAddress,
          body.deliveryLat,
          body.deliveryLng
        ]
      );

      await insertOrderItems(client, order.rows[0].id, body.items);

      await client.query(
        `insert into order_status_history (order_id, status, changed_by, note)
         values ($1, 'created', $2, 'Order placed')`,
        [order.rows[0].id, req.user!.id]
      );

      return { statusCode: 201, body: { id: order.rows[0].id, ...pricing, status: "created", estimatedDeliveryAt: order.rows[0].estimated_delivery_at } };
    });

    if (idempotencyKey) {
      await query(
        `insert into idempotency_keys (key, user_id, scope, request_hash, response_status, response_body)
         values ($1, $2, 'order:create', $3, $4, $5)
         on conflict (key, user_id, scope) do nothing`,
        [idempotencyKey, req.user!.id, requestHash, result.statusCode, result.body]
      );
    }

    res.status(result.statusCode).json(result.body);
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

orderRoutes.post("/auto-cancel", requireRole("admin", "super_admin"), async (_req, res, next) => {
  try {
    const cancelled = await query<{ id: string }>(
      `update orders
       set status = 'cancelled',
           cancellation_reason = 'Restaurant did not accept before auto-cancel deadline',
           cancelled_at = now(),
           updated_at = now()
       where status = 'created'
         and auto_cancel_at <= now()
       returning id`
    );

    for (const order of cancelled.rows) {
      await recordStatusHistory(order.id, "cancelled", null, "Auto-cancelled because restaurant did not accept");
      await createRefundForPaidOrder(order.id, "Auto-cancel refund: restaurant did not accept");
      emitOrderUpdate(order.id, { id: order.id, status: "cancelled" });
    }

    res.json({ cancelled: cancelled.rows.length, orderIds: cancelled.rows.map(order => order.id) });
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
        `select o.*, d.phone as driver_phone, d.name as driver_name
         from orders o
         left join users d on d.id = o.driver_id
         where o.id = $1
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

orderRoutes.post("/:id/reorder", requireRole("customer", "admin", "super_admin"), async (req, res, next) => {
  try {
    const original = await query<{
      restaurant_id: string;
      delivery_address: string;
      delivery_lat: string;
      delivery_lng: string;
    }>(
      `select restaurant_id, delivery_address, delivery_lat, delivery_lng
       from orders
       where id = $1
         and (customer_id = $2 or $3::text in ('admin', 'super_admin'))`,
      [req.params.id, req.user!.id, req.user!.role]
    );
    const source = original.rows[0];
    if (!source) {
      return res.status(404).json({ error: "Original order not found" });
    }

    const items = await query<{ name: string; quantity: number; price_paise: number; modifiers: unknown }>(
      "select name, quantity, price_paise, modifiers from order_items where order_id = $1",
      [req.params.id]
    );
    const orderItems: OrderItemInput[] = items.rows.map(item => ({
      name: item.name,
      quantity: Number(item.quantity),
      pricePaise: Number(item.price_paise),
      modifiers: Array.isArray(item.modifiers)
        ? item.modifiers.map(modifier => cartModifierInput.parse(modifier))
        : []
    }));

    const created = await transaction(async client => {
      const pricing = await priceOrder(client, orderItems);
      if ("error" in pricing) {
        return { statusCode: 400, body: { error: pricing.error } };
      }
      const order = await client.query<{ id: string; estimated_delivery_at: string }>(
        `insert into orders (
           customer_id, restaurant_id, status, total_paise, subtotal_paise,
           tax_paise, platform_fee_paise, delivery_fee_paise, discount_paise,
           coupon_code, delivery_address, delivery_lat, delivery_lng,
           auto_cancel_at, estimated_delivery_at
         )
         values ($1, $2, 'created', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now() + interval '10 minutes', now() + interval '45 minutes')
         returning id, estimated_delivery_at`,
        [
          req.user!.id,
          source.restaurant_id,
          pricing.totalPaise,
          pricing.subtotalPaise,
          pricing.taxPaise,
          pricing.platformFeePaise,
          pricing.deliveryFeePaise,
          pricing.discountPaise,
          pricing.couponCode,
          source.delivery_address,
          source.delivery_lat,
          source.delivery_lng
        ]
      );

      await insertOrderItems(client, order.rows[0].id, orderItems);

      await client.query(
        `insert into order_status_history (order_id, status, changed_by, note)
         values ($1, 'created', $2, $3)`,
        [order.rows[0].id, req.user!.id, `Reordered from ${req.params.id}`]
      );

      return { statusCode: 201, body: { id: order.rows[0].id, ...pricing, status: "created", estimatedDeliveryAt: order.rows[0].estimated_delivery_at } };
    });

    res.status(created.statusCode).json(created.body);
  } catch (error) {
    next(error);
  }
});

orderRoutes.patch("/:id", requireRole("customer", "admin", "super_admin"), async (req, res, next) => {
  try {
    const orderId = routeParam(req.params.id);
    const body = z.object({
      deliveryAddress: z.string().min(5).optional(),
      deliveryLat: z.number().optional(),
      deliveryLng: z.number().optional(),
      couponCode: z.string().trim().min(2).max(32).optional(),
      items: z.array(orderItemInput).min(1).optional()
    }).parse(req.body);

    const result = await transaction(async client => {
      const current = await client.query<{ id: string; customer_id: string; status: string; delivery_address: string; delivery_lat: string; delivery_lng: string }>(
        "select * from orders where id = $1 for update",
        [orderId]
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

      const pricing = body.items ? await priceOrder(client, body.items, body.couponCode) : null;
      if (pricing && "error" in pricing) {
        return { statusCode: 400, body: { error: pricing.error } };
      }
      const updated = await client.query(
        `update orders
         set delivery_address = coalesce($1, delivery_address),
             delivery_lat = coalesce($2, delivery_lat),
             delivery_lng = coalesce($3, delivery_lng),
             total_paise = coalesce($4, total_paise),
             subtotal_paise = coalesce($5, subtotal_paise),
             tax_paise = coalesce($6, tax_paise),
             platform_fee_paise = coalesce($7, platform_fee_paise),
             delivery_fee_paise = coalesce($8, delivery_fee_paise),
             discount_paise = coalesce($9, discount_paise),
             coupon_code = coalesce($10, coupon_code),
             updated_at = now()
         where id = $11
         returning *`,
        [
          body.deliveryAddress ?? null,
          body.deliveryLat ?? null,
          body.deliveryLng ?? null,
          pricing && !("error" in pricing) ? pricing.totalPaise : null,
          pricing && !("error" in pricing) ? pricing.subtotalPaise : null,
          pricing && !("error" in pricing) ? pricing.taxPaise : null,
          pricing && !("error" in pricing) ? pricing.platformFeePaise : null,
          pricing && !("error" in pricing) ? pricing.deliveryFeePaise : null,
          pricing && !("error" in pricing) ? pricing.discountPaise : null,
          pricing && !("error" in pricing) ? pricing.couponCode : null,
          orderId
        ]
      );

      if (body.items) {
        await client.query("delete from order_items where order_id = $1", [orderId]);
        await insertOrderItems(client, orderId, body.items);
      }

      await client.query(
        `insert into order_status_history (order_id, status, changed_by, note)
         values ($1, 'created', $2, 'Order edited before confirmation')`,
        [orderId, req.user!.id]
      );

      return { statusCode: 200, body: updated.rows[0] };
    });

    if (result.statusCode === 200) {
      emitOrderUpdate(orderId, result.body);
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

    emitOrderUpdate(routeParam(req.params.id), result.rows[0]);
    await recordStatusHistory(routeParam(req.params.id), result.rows[0].status, req.user!.id, "Delivery partner assigned");
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
        await createRefundForPaidOrder(routeParam(req.params.id), body.reason);
      }

      return { statusCode: 200, body: updated.rows[0] };
    });

    if (result.statusCode === 200) {
      emitOrderUpdate(routeParam(req.params.id), result.body);
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

    const etaInterval = body.status === "accepted" ? "45 minutes"
      : body.status === "preparing" ? "35 minutes"
      : body.status === "ready" ? "25 minutes"
      : body.status === "picked_up" ? "20 minutes"
      : null;

    const result = await query(
      `update orders
       set status = $1::order_status,
           estimated_delivery_at = case
             when $2::boolean then coalesce(estimated_delivery_at, now() + $3::interval)
             when $4::boolean then now() + $3::interval
             else estimated_delivery_at
           end,
           updated_at = now()
       where id = $5
         and ($6::text <> 'driver' or driver_id = $7)
       returning *`,
      [
        body.status,
        etaInterval !== null && body.status !== "picked_up",
        etaInterval ? `${etaInterval}` : "0 minutes",
        body.status === "picked_up",
        req.params.id,
        req.user!.role,
        req.user!.id
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Order not found or not assigned to this delivery partner" });
    }

    emitOrderUpdate(routeParam(req.params.id), result.rows[0]);
    await recordStatusHistory(routeParam(req.params.id), body.status as string, req.user!.id, `Status changed to ${body.status}`);
    if (body.status === "delivered" && result.rows[0].driver_id) {
      await recordDriverEarning(result.rows[0].driver_id, routeParam(req.params.id), Number(result.rows[0].total_paise));
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

async function recordDriverEarning(driverId: string, orderId: string, totalPaise: number) {
  const amountPaise = Math.max(3000, Math.round(totalPaise * 0.12));
  await query(
    `insert into wallet_accounts (user_id, balance_paise, total_earnings_paise)
     values ($1, $2, $2)
     on conflict (user_id) do nothing`,
    [driverId, 0]
  );
  await query(
    `with earning as (
       insert into driver_earnings (driver_id, order_id, amount_paise)
       values ($1, $2, $3)
       on conflict (order_id) do nothing
       returning driver_id, order_id, amount_paise
     ),
     wallet_update as (
       update wallet_accounts wa
       set balance_paise = balance_paise + earning.amount_paise,
           total_earnings_paise = total_earnings_paise + earning.amount_paise,
           updated_at = now()
       from earning
       where wa.user_id = earning.driver_id
       returning earning.driver_id, earning.order_id, earning.amount_paise
     )
     insert into wallet_transactions (user_id, type, amount_paise, reference_type, reference_id, status)
     select driver_id, 'earning', amount_paise, 'order', order_id, 'posted'
     from wallet_update`,
    [driverId, orderId, amountPaise]
  );
}

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

async function recordStatusHistory(orderId: string, status: string, userId: string | null, note: string) {
  await query(
    `insert into order_status_history (order_id, status, changed_by, note)
     values ($1, $2::order_status, $3, $4)`,
    [orderId, status, userId, note]
  );
}

async function createRefundForPaidOrder(orderId: string, reason: string) {
  const paidPayment = await query<{ id: string; provider: string; amount_paise: number }>(
    `select id, provider, amount_paise
     from payments
     where order_id = $1
       and lower(status) in ('paid', 'success', 'txn_success', 'payment_success', 'completed', 'captured')
     order by created_at desc
     limit 1`,
    [orderId]
  );

  if (!paidPayment.rows[0]) {
    return;
  }

  await query(
    `insert into refunds (order_id, payment_id, provider, amount_paise, status, reason)
     values ($1, $2, $3, $4, 'requested', $5)`,
    [orderId, paidPayment.rows[0].id, paidPayment.rows[0].provider, paidPayment.rows[0].amount_paise, reason]
  );
}
