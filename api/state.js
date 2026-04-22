import {
  getSessionUser, getBearerToken, getState, setState, readBody, json
} from "./_lib.js";

export default async function handler(req, res) {
  const user = await getSessionUser(getBearerToken(req));
  if (!user) return json(res, 401, { error: "unauthorized" });

  if (req.method === "GET") {
    const state = await getState();
    return json(res, 200, { ...state, you: user });
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    const state = await getState();

    // --- Supported operations ---
    // { op: "check", key, checked }
    // { op: "setWeek", week: 1..4 | null }
    // { op: "review", isoWeek: "2026-W17", good, better, adjust }
    // { op: "clearDay", date: "YYYY-MM-DD" }  — debug / reset helper

    if (body.op === "check") {
      if (!body.key) return json(res, 400, { error: "missing_key" });
      if (body.checked) {
        state.checks[body.key] = { by: user, at: Date.now() };
      } else {
        delete state.checks[body.key];
      }
    } else if (body.op === "setWeek") {
      if (body.week === null) {
        state.weekOverride = null;
      } else if ([1,2,3,4].includes(body.week)) {
        state.weekOverride = { week: body.week, setBy: user, setAt: Date.now() };
      } else {
        return json(res, 400, { error: "invalid_week" });
      }
    } else if (body.op === "review") {
      if (!body.isoWeek) return json(res, 400, { error: "missing_week" });
      state.reviews[body.isoWeek] = {
        good: body.good || "",
        better: body.better || "",
        adjust: body.adjust || "",
        by: user,
        at: Date.now(),
      };
    } else if (body.op === "clearDay") {
      if (!body.date) return json(res, 400, { error: "missing_date" });
      const prefix = body.date + "|";
      for (const k of Object.keys(state.checks)) {
        if (k.startsWith(prefix)) delete state.checks[k];
      }
    } else {
      return json(res, 400, { error: "unknown_op" });
    }

    const saved = await setState(state);
    return json(res, 200, { ...saved, you: user });
  }

  return json(res, 405, { error: "method_not_allowed" });
}
