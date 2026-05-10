import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config";

export type AuthUser = {
  id: string;
  role: UserRole;
};

export type UserRole = "customer" | "driver" | "restaurant" | "admin" | "super_admin" | "delivery_admin";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, config.jwtSecret, { expiresIn: "1h" });
}

export function signRefreshToken(user: AuthUser) {
  return jwt.sign({ id: user.id, role: user.role }, config.jwtSecret + ":refresh", { expiresIn: "30d" });
}

export function verifyRefreshToken(token: string): AuthUser {
  return jwt.verify(token, config.jwtSecret + ":refresh") as AuthUser;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" });
  }

  try {
    req.user = jwt.verify(token, config.jwtSecret) as AuthUser;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}
