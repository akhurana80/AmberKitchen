import { Router } from "express";
import { z } from "zod";
import { query } from "../db";
import { signToken, signRefreshToken, verifyRefreshToken, UserRole } from "../auth";
import { createOtp, verifyOtp } from "../services/otp.service";
import { verifyGoogleIdToken } from "../services/google-auth.service";

export const authRoutes = Router();

authRoutes.post("/otp/request", async (req, res, next) => {
  try {
    const body = z.object({ phone: z.string().min(8) }).parse(req.body);
    res.json(await createOtp(body.phone));
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/otp/verify", async (req, res, next) => {
  try {
    const body = z.object({
      phone: z.string().min(8),
      code: z.string().length(6),
      role: z.enum(["customer", "driver", "restaurant", "admin", "super_admin", "delivery_admin"]).default("customer")
    }).parse(req.body);

    const valid = await verifyOtp(body.phone, body.code);
    if (!valid) {
      return res.status(401).json({ error: "Invalid OTP" });
    }

    const user = await upsertUser({ phone: body.phone, role: body.role });
    const authUser = { id: user.id, role: user.role };
    res.json({ token: signToken(authUser), refreshToken: signRefreshToken(authUser), user });
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/google", async (req, res, next) => {
  try {
    const body = z.object({
      idToken: z.string().min(20),
      role: z.enum(["customer", "driver", "restaurant", "admin", "super_admin", "delivery_admin"]).default("customer")
    }).parse(req.body);
    const profile = await verifyGoogleIdToken(body.idToken);
    const user = await upsertUser({ email: profile.email, name: profile.name, googleId: profile.googleId, role: body.role });
    const authUser = { id: user.id, role: user.role };
    res.json({ token: signToken(authUser), refreshToken: signRefreshToken(authUser), user });
  } catch (error) {
    next(error);
  }
});

authRoutes.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string().min(10) }).parse(req.body);
    const decoded = verifyRefreshToken(refreshToken);
    const result = await query<{ id: string; role: UserRole }>(
      "select id, role from users where id = $1",
      [decoded.id]
    );
    if (!result.rows[0]) return res.status(401).json({ error: "User not found" });
    const authUser = { id: result.rows[0].id, role: result.rows[0].role };
    res.json({ token: signToken(authUser), refreshToken: signRefreshToken(authUser) });
  } catch {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

async function upsertUser(input: {
  phone?: string;
  email?: string;
  name?: string;
  googleId?: string;
  role: UserRole;
}) {
  const existing = await query<{ id: string }>(
    `select id from users
     where ($1::text is not null and phone = $1)
        or ($2::text is not null and email = $2)
        or ($3::text is not null and google_id = $3)
     limit 1`,
    [input.phone ?? null, input.email ?? null, input.googleId ?? null]
  );

  if (existing.rows[0]) {
    const result = await query<{ id: string; phone: string | null; email: string | null; name: string | null; role: typeof input.role }>(
      `update users
       set phone = coalesce($2, phone),
           email = coalesce($3, email),
           name = coalesce($4, name),
           google_id = coalesce($5, google_id),
           role = $6,
           updated_at = now()
       where id = $1
       returning id, phone, email, name, role`,
      [existing.rows[0].id, input.phone ?? null, input.email ?? null, input.name ?? null, input.googleId ?? null, input.role]
    );

    return result.rows[0];
  }

  const result = await query<{ id: string; phone: string | null; email: string | null; name: string | null; role: typeof input.role }>(
    `insert into users (phone, email, name, google_id, role)
     values ($1, $2, $3, $4, $5)
     returning id, phone, email, name, role`,
    [input.phone ?? null, input.email ?? null, input.name ?? null, input.googleId ?? null, input.role]
  );

  return result.rows[0];
}
