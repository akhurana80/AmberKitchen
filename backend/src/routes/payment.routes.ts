import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth";
import { createPayment, recordPaymentCallback, verifyPhonePeTransaction } from "../services/payment.service";

export const paymentRoutes = Router();

paymentRoutes.post("/create", requireAuth, async (req, res, next) => {
  try {
    const body = z.object({
      provider: z.enum(["paytm", "phonepe"]),
      orderId: z.string().uuid(),
      amountPaise: z.number().int().positive()
    }).parse(req.body);

    res.status(201).json(await createPayment(body.provider, body.orderId, body.amountPaise));
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
    const response = await verifyPhonePeTransaction(req.params.transactionId);
    res.json(response.data);
  } catch (error) {
    next(error);
  }
});
