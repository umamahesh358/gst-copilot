import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required. Set it to a random 64+ character string.");
}
const JWT_SECRET = process.env.SESSION_SECRET;

export interface AuthRequest extends Request {
  userId?: number;
  user?: typeof usersTable.$inferSelect;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
  }
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "24h" });
}

export async function loadUser(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    next();
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId)).limit(1);
  if (user) req.user = user;
  next();
}
