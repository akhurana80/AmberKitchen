import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth";
import { query, transaction } from "../db";

export const driverOnboardingRoutes = Router();

function routeParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? "";
}

function referralCode(userId: string) {
  return `AKD${userId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function mockOcrConfidence(aadhaarLast4: string, frontUrl?: string, backUrl?: string) {
  if (!/^\d{4}$/.test(aadhaarLast4)) {
    return { status: "failed", confidence: 0 };
  }
  const documentScore = frontUrl && backUrl ? 94 : 78;
  return { status: documentScore >= 80 ? "verified" : "pending", confidence: documentScore };
}

function mockFaceMatchScore(selfieUrl?: string, aadhaarFrontUrl?: string) {
  if (!selfieUrl || !aadhaarFrontUrl) {
    return { status: "pending", score: 0 };
  }
  return { status: "verified", score: 91 };
}

driverOnboardingRoutes.use(requireAuth);

driverOnboardingRoutes.post("/signup", requireRole("driver", "admin", "super_admin"), async (req, res, next) => {
  try {
    const body = z.object({
      fullName: z.string().min(2),
      phone: z.string().min(8).optional(),
      aadhaarLast4: z.string().regex(/^\d{4}$/),
      aadhaarFrontUrl: z.string().min(10).optional(),
      aadhaarBackUrl: z.string().min(10).optional(),
      selfieUrl: z.string().min(10).optional(),
      bankAccountLast4: z.string().regex(/^\d{4}$/).optional(),
      upiId: z.string().min(3).optional(),
      referredByCode: z.string().optional()
    }).parse(req.body);

    const ocr = mockOcrConfidence(body.aadhaarLast4, body.aadhaarFrontUrl, body.aadhaarBackUrl);
    const selfie = mockFaceMatchScore(body.selfieUrl, body.aadhaarFrontUrl);
    const code = referralCode(req.user!.id);

    const result = await transaction(async client => {
      const onboarding = await client.query(
        `insert into driver_onboarding (
           user_id, full_name, phone, aadhaar_last4, aadhaar_front_url, aadhaar_back_url,
           selfie_url, ocr_status, ocr_confidence, selfie_status, selfie_match_score,
           background_check_status, bank_account_last4, upi_id, referral_code,
           referred_by_code, approval_status, updated_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, $13, $14, $15, 'pending', now())
         on conflict (user_id) do update
         set full_name = excluded.full_name,
             phone = excluded.phone,
             aadhaar_last4 = excluded.aadhaar_last4,
             aadhaar_front_url = excluded.aadhaar_front_url,
             aadhaar_back_url = excluded.aadhaar_back_url,
             selfie_url = excluded.selfie_url,
             ocr_status = excluded.ocr_status,
             ocr_confidence = excluded.ocr_confidence,
             selfie_status = excluded.selfie_status,
             selfie_match_score = excluded.selfie_match_score,
             bank_account_last4 = excluded.bank_account_last4,
             upi_id = excluded.upi_id,
             referred_by_code = excluded.referred_by_code,
             approval_status = case when driver_onboarding.approval_status = 'approved' then 'approved' else 'pending' end,
             updated_at = now()
         returning *`,
        [
          req.user!.id,
          body.fullName,
          body.phone ?? null,
          body.aadhaarLast4,
          body.aadhaarFrontUrl ?? null,
          body.aadhaarBackUrl ?? null,
          body.selfieUrl ?? null,
          ocr.status,
          ocr.confidence,
          selfie.status,
          selfie.score,
          body.bankAccountLast4 ?? null,
          body.upiId ?? null,
          code,
          body.referredByCode ?? null
        ]
      );

      if (body.referredByCode) {
        const referrer = await client.query<{ user_id: string }>(
          "select user_id from driver_onboarding where referral_code = $1",
          [body.referredByCode]
        );
        await client.query(
          `insert into driver_referrals (referrer_driver_id, referred_driver_id, referral_code)
           values ($1, $2, $3)
           on conflict do nothing`,
          [referrer.rows[0]?.user_id ?? null, req.user!.id, body.referredByCode]
        );
      }

      return onboarding.rows[0];
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

driverOnboardingRoutes.get("/mine", requireRole("driver", "admin", "super_admin"), async (req, res, next) => {
  try {
    const result = await query("select * from driver_onboarding where user_id = $1", [req.user!.id]);
    res.json(result.rows[0] ?? null);
  } catch (error) {
    next(error);
  }
});

driverOnboardingRoutes.post("/background-check", requireRole("driver", "admin", "super_admin"), async (req, res, next) => {
  try {
    const body = z.object({
      consent: z.literal(true)
    }).parse(req.body);

    const result = await query(
      `update driver_onboarding
       set background_check_status = case
             when ocr_status = 'verified' and selfie_status = 'verified' then 'clear'
             else 'pending'
           end,
           updated_at = now()
       where user_id = $1 and $2::boolean = true
       returning *`,
      [req.user!.id, body.consent]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

driverOnboardingRoutes.get("/admin/applications", requireRole("delivery_admin", "admin", "super_admin"), async (_req, res, next) => {
  try {
    const result = await query(
      `select d.*, u.email, u.phone as user_phone
       from driver_onboarding d
       join users u on u.id = d.user_id
       order by
         case d.approval_status when 'pending' then 0 when 'draft' then 1 when 'approved' then 2 else 3 end,
         d.created_at desc`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

driverOnboardingRoutes.patch("/admin/applications/:id/approval", requireRole("delivery_admin", "admin", "super_admin"), async (req, res, next) => {
  try {
    const body = z.object({
      status: z.enum(["approved", "rejected", "pending"]),
      note: z.string().optional()
    }).parse(req.body);

    const result = await transaction(async client => {
      const application = await client.query<{ user_id: string }>(
        `update driver_onboarding
         set approval_status = $1,
             admin_note = $2,
             approved_by = case when $1 = 'approved' then $3 else approved_by end,
             approved_at = case when $1 = 'approved' then now() else approved_at end,
             updated_at = now()
         where id = $4
         returning *`,
        [body.status, body.note ?? null, req.user!.id, routeParam(req.params.id)]
      );

      if (body.status === "approved" && application.rows[0]) {
        await client.query("update users set role = 'driver', updated_at = now() where id = $1", [application.rows[0].user_id]);
        await client.query(
          `update driver_referrals
           set status = 'qualified', reward_paise = 50000
           where referred_driver_id = $1 and status = 'pending'`,
          [application.rows[0].user_id]
        );
      }

      return application.rows[0];
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

driverOnboardingRoutes.get("/admin/referrals", requireRole("delivery_admin", "admin", "super_admin"), async (_req, res, next) => {
  try {
    const result = await query(
      `select dr.*, referrer.phone as referrer_phone, referred.phone as referred_phone
       from driver_referrals dr
       left join users referrer on referrer.id = dr.referrer_driver_id
       left join users referred on referred.id = dr.referred_driver_id
       order by dr.created_at desc`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});
