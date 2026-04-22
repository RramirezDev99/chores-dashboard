import { destroySession, json, getBearerToken } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
  await destroySession(getBearerToken(req));
  return json(res, 200, { ok: true });
}
