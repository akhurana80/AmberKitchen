import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth";
import { query, transaction } from "../db";

export const walletRoutes = Router();

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

async function ensureWallet(userId: string) {
  await query(
    `insert into wallet_accounts (user_id)
     values ($1)
     on conflict (user_id) do nothing`,
    [userId]
  );
}

walletRoutes.use(requireAuth);

walletRoutes.get("/summary", async (req, res, next) => {
  try {
    await ensureWallet(req.user!.id);
    const [wallet, earnings, payouts] = await Promise.all([
      query("select * from wallet_accounts where user_id = $1", [req.user!.id]),
      query(
        `select coalesce(sum(amount_paise), 0) as earned_paise, count(*) as deliveries
         from driver_earnings
         where driver_id = $1`,
        [req.user!.id]
      ),
      query(
        `select coalesce(sum(amount_paise), 0) as requested_paise, count(*) as requests
         from payouts
         where user_id = $1 and status in ('requested', 'approved', 'processing')`,
        [req.user!.id]
      )
    ]);

    res.json({
      wallet: wallet.rows[0],
      earnings: earnings.rows[0],
      pendingPayouts: payouts.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

walletRoutes.get("/transactions", async (req, res, next) => {
  try {
    const result = await query(
      `select * from wallet_transactions
       where user_id = $1
       order by created_at desc
       limit 100`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

walletRoutes.get("/earnings", requireRole("driver", "admin", "super_admin"), async (req, res, next) => {
  try {
    const driverId = req.user!.role === "driver" ? req.user!.id : String(req.query.driverId ?? req.user!.id);
    const result = await query(
      `select de.*, o.status as order_status, o.delivery_address
       from driver_earnings de
       join orders o on o.id = de.order_id
       where de.driver_id = $1
       order by de.created_at desc
       limit 100`,
      [driverId]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

walletRoutes.post("/payouts/request", requireRole("driver", "restaurant", "admin", "super_admin"), async (req, res, next) => {
  try {
    const body = z.object({
      amountPaise: z.number().int().positive(),
      method: z.enum(["upi", "bank"]),
      upiId: z.string().optional(),
      bankAccountLast4: z.string().regex(/^\d{4}$/).optional()
    }).parse(req.body);

    await ensureWallet(req.user!.id);
    const wallet = await query<{ balance_paise: number }>("select balance_paise from wallet_accounts where user_id = $1", [req.user!.id]);
    if (Number(wallet.rows[0]?.balance_paise ?? 0) < body.amountPaise) {
      return res.status(409).json({ error: "Insufficient wallet balance for payout request" });
    }

    const result = await query(
      `insert into payouts (user_id, amount_paise, method, upi_id, bank_account_last4)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [req.user!.id, body.amountPaise, body.method, body.upiId ?? null, body.bankAccountLast4 ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

walletRoutes.get("/payouts", requireRole("admin", "super_admin"), async (_req, res, next) => {
  try {
    const result = await query(
      `select p.*, u.phone, u.email, u.role
       from payouts p
       join users u on u.id = p.user_id
       order by p.created_at desc
       limit 200`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

walletRoutes.patch("/payouts/:id/approval", requireRole("admin", "super_admin"), async (req, res, next) => {
  try {
    const body = z.object({
      status: z.enum(["approved", "paid", "rejected"]),
      note: z.string().optional()
    }).parse(req.body);

    const result = await transaction(async client => {
      const payout = await client.query<{ id: string; user_id: string; amount_paise: number; status: string }>(
        "select * from payouts where id = $1 for update",
        [routeParam(req.params.id)]
      );
      const row = payout.rows[0];
      if (!row) {
        return null;
      }

      if (body.status === "paid" && row.status !== "paid") {
        await client.query(
          `update wallet_accounts
           set balance_paise = balance_paise - $2,
               total_payouts_paise = total_payouts_paise + $2,
               updated_at = now()
           where user_id = $1 and balance_paise >= $2`,
          [row.user_id, row.amount_paise]
        );
        await client.query(
          `insert into wallet_transactions (user_id, type, amount_paise, reference_type, reference_id, status)
           values ($1, 'payout', $2, 'payout', $3, 'posted')`,
          [row.user_id, -row.amount_paise, row.id]
        );
      }

      const updated = await client.query(
        `update payouts
         set status = $1,
             admin_note = $2,
             approved_by = $3,
             processed_at = case when $1 in ('paid', 'rejected') then now() else processed_at end,
             updated_at = now()
         where id = $4
         returning *`,
        [body.status, body.note ?? null, req.user!.id, row.id]
      );
      return updated.rows[0];
    });

    if (!result) {
      return res.status(404).json({ error: "Payout not found" });
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});
