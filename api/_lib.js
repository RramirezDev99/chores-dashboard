import { Redis } from "@upstash/redis";
import crypto from "node:crypto";

export const redis = Redis.fromEnv();

// --- Session helpers ---
// Sessions are just random tokens stored in Redis with TTL. Simpler than JWT,
// and we want the ability to revoke.

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function createSession(user) {
  const token = crypto.randomBytes(32).toString("hex");
  await redis.set(`session:${token}`, user, { ex: SESSION_TTL_SECONDS });
  return token;
}

export async function getSessionUser(token) {
  if (!token) return null;
  return await redis.get(`session:${token}`);
}

export async function destroySession(token) {
  if (!token) return;
  await redis.del(`session:${token}`);
}

export function getBearerToken(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7);
  return null;
}

// --- Response helpers ---
export function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(body));
}

// Body parser — Vercel gives us a parsed body for JSON, but we defensively handle raw too
export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

// --- Rate limit (very light — prevents brute force of passwords) ---
export async function rateLimit(key, max, windowSec) {
  const n = await redis.incr(`rl:${key}`);
  if (n === 1) await redis.expire(`rl:${key}`, windowSec);
  return n <= max;
}

// --- State helpers ---
// Shared state is stored under a single key as a JSON hash so we can atomically merge.
// Schema: { checks: { "YYYY-MM-DD|taskId": { by: "ruben", at: 1234567890 } },
//           weekOverride: { week: 2, setBy: "ruben", setAt: 1234 } | null,
//           reviews: { "YYYY-WW": { good, better, adjust, at, by } },
//           updated: timestamp }

const STATE_KEY = "chores:state:v1";

export async function getState() {
  const raw = await redis.get(STATE_KEY);
  if (!raw) return { checks: {}, weekOverride: null, reviews: {}, updated: 0 };
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return { checks: {}, weekOverride: null, reviews: {}, updated: 0 }; }
  }
  return raw; // @upstash/redis auto-parses JSON
}

export async function setState(state) {
  state.updated = Date.now();
  await redis.set(STATE_KEY, JSON.stringify(state));
  return state;
}
