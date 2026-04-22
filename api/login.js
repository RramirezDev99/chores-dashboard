import { createSession, json, readBody, rateLimit } from "./_lib.js";

const USERS = {
  ruben:   { envVar: "PW_RUBEN" },
  natalia: { envVar: "PW_NATALIA" },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });

  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  const ok = await rateLimit(`login:${ip}`, 10, 60 * 5); // 10 attempts per 5 min
  if (!ok) return json(res, 429, { error: "too_many_attempts" });

  const body = await readBody(req);
  const { user, password } = body || {};
  if (!user || !password) return json(res, 400, { error: "missing_fields" });
  if (!USERS[user]) return json(res, 400, { error: "unknown_user" });

  const expected = process.env[USERS[user].envVar];
  if (!expected) return json(res, 500, { error: "server_misconfigured" });
  if (password !== expected) return json(res, 401, { error: "bad_password" });

  const token = await createSession(user);
  return json(res, 200, { token, user });
}
