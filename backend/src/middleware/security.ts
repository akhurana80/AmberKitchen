import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { query } from "../db";

const buckets = new Map<string, { count: number; resetAt: number }>();

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      rawBody?: Buffer;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = req.header("x-request-id") ?? randomUUID();
  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
}

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  const existing = buckets.get(key);
  const bucket = existing && existing.resetAt > now
    ? existing
    : { count: 0, resetAt: now + config.rateLimitWindowMs };

  bucket.count += 1;
  buckets.set(key, bucket);

  res.setHeader("x-rate-limit-limit", String(config.rateLimitMax));
  res.setHeader("x-rate-limit-remaining", String(Math.max(0, config.rateLimitMax - bucket.count)));
  if (bucket.count > config.rateLimitMax) {
    return res.status(429).json({ error: "Too many requests" });
  }
  return next();
}

export function auditLog(req: Request, res: Response, next: NextFunction) {
  const started = Date.now();
  res.on("finish", () => {
    if (req.path === "/health") {
      return;
    }
    void query(
      `insert into audit_logs (request_id, user_id, method, path, status_code, ip, user_agent, duration_ms)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.requestId ?? null,
        req.user?.id ?? null,
        req.method,
        req.originalUrl,
        res.statusCode,
        req.ip,
        req.header("user-agent") ?? null,
        Date.now() - started
      ]
    ).catch(() => undefined);
  });
  next();
}
