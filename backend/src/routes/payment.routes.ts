import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth";
import { createPayment, createRefund, PaymentProvider, recordPaymentCallback, verifyPhonePeTransaction } from "../services/payment.service";
import { query } from "../db";

export const paymentRoutes = Router();

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

paymentRoutes.post("/create", requireAuth, async (req, res, next) => {
  try {
    const body = z.object({
      provider: z.enum(["paytm", "phonepe", "razorpay"]),
      orderId: z.string().uuid(),
      amountPaise: z.number().int().positive()
    }).parse(req.body);

    res.status(201).json(await createPayment(body.provider as PaymentProvider, body.orderId, body.amountPaise));
  } catch (error) {
    next(error);
  }
});

paymentRoutes.post("/razorpay/callback", async (req, res, next) => {
  try {
    const transactionId = req.body.payload?.order?.entity?.receipt ?? req.body.receipt ?? req.body.order_id;
    const status = req.body.event ?? req.body.status ?? "unknown";
    await recordPaymentCallback("razorpay", transactionId, status, req.body);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

paymentRoutes.post("/paytm/callback", async (req, res, next) => {
  try {
    await recordPaymentCallback("paytm", req.body.ORDERID, req.body.STATUS ?? "unknown", req.body);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

paymentRoutes.post("/phonepe/callback", async (req, res, next) => {
  try {
    const transactionId = req.body.data?.merchantTransactionId ?? req.body.merchantTransactionId;
    const status = req.body.code ?? req.body.status ?? "unknown";
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
