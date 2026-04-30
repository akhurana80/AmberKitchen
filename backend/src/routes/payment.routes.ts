import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth";
import {
  createPayment,
  createRefund,
  PaymentProvider,
  recordPaymentCallback,
  verifyPhonePeTransaction,
  verifyPhonePeWebhook,
  verifyRazorpayWebhook
} from "../services/payment.service";
import { query } from "../db";

export const paymentRoutes = Router();

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

async function recordWebhookEvent(provider: string, eventId: string, transactionId: string | null, status: string, payload: unknown) {
  const result = await query<{ inserted: boolean }>(
    `insert into webhook_events (provider, event_id, transaction_id, status, raw_payload)
     values ($1, $2, $3, $4, $5)
     on conflict (provider, event_id) do nothing
     returning true as inserted`,
    [provider, eventId, transactionId, status, payload]
  );
  return Boolean(result.rows[0]?.inserted);
}

function normalizePaymentState(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();
  if ([
    "paid",
    "success",
    "txn_success",
    "payment_success",
    "completed",
    "captured",
    "authorized",
    "order.paid",
    "payment.captured",
    "payment.authorized"
  ].includes(normalized)) {
    return "success";
  }
  if ([
    "failed",
    "failure",
    "txn_failure",
    "payment_failed",
    "payment.failed",
    "declined",
    "cancelled",
    "canceled",
    "expired",
    "timed_out",
    "user_dropped"
  ].includes(normalized)) {
    return "failure";
  }
  if (normalized) {
    return "pending";
  }
  return "not_started";
}

paymentRoutes.post("/create", requireAuth, async (req, res, next) => {
  try {
    const body = z.object({
      provider: z.enum(["paytm", "phonepe", "razorpay"]),
      orderId: z.string().uuid(),
      amountPaise: z.number().int().positive()
    }).parse(req.body);

    const order = await query<{ id: string; total_paise: number }>(
      `select id, total_paise
       from orders
       where id = $1
         and (customer_id = $2 or $3::text in ('admin', 'super_admin'))`,
      [body.orderId, req.user!.id, req.user!.role]
    );
    if (!order.rows[0]) {
      return res.status(403).json({ error: "Payment can be created only by the customer or an admin" });
    }
    if (Number(order.rows[0].total_paise) !== body.amountPaise) {
      return res.status(400).json({ error: "Payment amount must match the order total" });
    }

    res.status(201).json(await createPayment(body.provider as PaymentProvider, body.orderId, body.amountPaise));
  } catch (error) {
    next(error);
  }
});

paymentRoutes.get("/orders/:orderId/status", requireAuth, async (req, res, next) => {
  try {
    const orderId = routeParam(req.params.orderId);
    const allowed = await query(
      `select id from orders
       where id = $1
         and (customer_id = $2 or $3::text in ('admin', 'super_admin'))`,
      [orderId, req.user!.id, req.user!.role]
    );
    if (!allowed.rows[0]) {
      return res.status(403).json({ error: "Payment status can be viewed only by the customer or an admin" });
    }

    const [payment, refunds] = await Promise.all([
      query(
        `select id, order_id, provider, amount_paise, status, raw_callback, created_at, updated_at
         from payments
         where order_id = $1
         order by created_at desc
         limit 1`,
        [orderId]
      ),
      query(
        `select id, order_id, payment_id, provider, amount_paise, status, reason, raw_response, created_at, updated_at
         from refunds
         where order_id = $1
         order by created_at desc`,
        [orderId]
      )
    ]);
    const latestPayment = payment.rows[0] ?? null;
    res.json({
      orderId,
      state: normalizePaymentState(latestPayment?.status),
      payment: latestPayment,
      refunds: refunds.rows
    });
  } catch (error) {
    next(error);
  }
});

paymentRoutes.post("/razorpay/callback", async (req, res, next) => {
  try {
    if (!verifyRazorpayWebhook(req.rawBody, req.header("x-razorpay-signature"))) {
      return res.status(401).json({ error: "Invalid Razorpay webhook signature" });
    }
    const eventId = req.body.event_id ?? req.body.payload?.payment?.entity?.id ?? req.body.payload?.order?.entity?.id ?? req.body.receipt ?? req.body.order_id ?? req.requestId;
    const transactionId = req.body.payload?.order?.entity?.receipt ?? req.body.receipt ?? req.body.order_id ?? eventId;
    const status = req.body.event ?? req.body.status ?? "unknown";
    const inserted = await recordWebhookEvent("razorpay", eventId, transactionId ?? null, status, req.body);
    if (!inserted) {
      return res.json({ ok: true, duplicate: true });
    }
    await recordPaymentCallback("razorpay", transactionId, status, req.body);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

paymentRoutes.post("/paytm/callback", async (req, res, next) => {
  try {
    const eventId = req.body.TXNID ?? req.body.ORDERID ?? req.requestId;
    const transactionId = req.body.ORDERID ?? eventId;
    const status = req.body.STATUS ?? "unknown";
    const inserted = await recordWebhookEvent("paytm", eventId, transactionId ?? null, status, req.body);
    if (!inserted) {
      return res.json({ ok: true, duplicate: true });
    }
    await recordPaymentCallback("paytm", transactionId, status, req.body);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

paymentRoutes.post("/phonepe/callback", async (req, res, next) => {
  try {
    if (!verifyPhonePeWebhook(req.rawBody, req.header("x-verify"))) {
      return res.status(401).json({ error: "Invalid PhonePe webhook signature" });
    }
    const eventId = req.body.data?.transactionId ?? req.body.transactionId ?? req.body.data?.merchantTransactionId ?? req.body.merchantTransactionId ?? req.requestId;
    const transactionId = req.body.data?.merchantTransactionId ?? req.body.merchantTransactionId ?? eventId;
    const status = req.body.code ?? req.body.status ?? "unknown";
    const inserted = await recordWebhookEvent("phonepe", eventId, transactionId ?? null, status, req.body);
    if (!inserted) {
      return res.json({ ok: true, duplicate: true });
    }
    await recordPaymentCallback("phonepe", transactionId, status, req.body);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

paymentRoutes.get("/phonepe/:transactionId/status", requireAuth, async (req, res, next) => {
  try {
    const response = await verifyPhonePeTransaction(routeParam(req.params.transactionId));
    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

paymentRoutes.post("/refunds", requireAuth, async (req, res, next) => {
  try {
    const body = z.object({
      orderId: z.string().uuid(),
      reason: z.string().min(3).max(500),
      amountPaise: z.number().int().positive().optional()
    }).parse(req.body);

    const allowed = await query(
      `select id from orders
       where id = $1
         and (customer_id = $2 or $3::text in ('admin', 'super_admin'))`,
      [body.orderId, req.user!.id, req.user!.role]
    );
    if (!allowed.rows[0]) {
      return res.status(403).json({ error: "Refund can be requested only by the customer or an admin" });
    }

    res.status(201).json(await createRefund(body.orderId, body.reason, body.amountPaise));
  } catch (error) {
    next(error);
  }
});

paymentRoutes.get("/refunds", requireAuth, requireRole("admin", "super_admin"), async (_req, res, next) => {
  try {
    const result = await query("select * from refunds order by created_at desc limit 100");
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});
