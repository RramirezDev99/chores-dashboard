import {
  getSessionUser, getBearerToken, getState, setState, readBody, json
} from "./_lib.js";
import crypto from "node:crypto";

const VALID_WHO    = new Set(["ruben", "natalia", "both"]);
const VALID_GROUP  = new Set(["comidas", "perros", "limpieza", "baños", "ropa", "exterior", "mensual", "otros"]);
const VALID_DAYS   = new Set(["lunes","martes","miercoles","jueves","viernes","sabado","domingo"]);
const VALID_WEEKS  = new Set([1,2,3,4]);
const VALID_RECUR  = new Set(["once", "daily", "weekly"]);

function validateCustomTask(t) {
  if (!t || typeof t !== "object")                   return "invalid_task";
  if (typeof t.t !== "string" || !t.t.trim())       return "missing_text";
  if (t.t.length > 120)                              return "text_too_long";
  if (!VALID_WHO.has(t.who))                         return "invalid_who";
  if (!VALID_GROUP.has(t.group))                     return "invalid_group";
  if (!VALID_RECUR.has(t.recurrence))                return "invalid_recurrence";
  if (t.recurrence === "once") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date || ""))   return "invalid_date";
  }
  if (t.recurrence === "weekly") {
    if (!Array.isArray(t.days) || t.days.length === 0) return "missing_days";
    if (t.days.some(d => !VALID_DAYS.has(d)))         return "invalid_days";
    if (!Array.isArray(t.weeks) || t.weeks.length === 0) return "missing_weeks";
    if (t.weeks.some(w => !VALID_WEEKS.has(Number(w)))) return "invalid_weeks";
  }
  return null;
}

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
    // { op: "review", isoWeek, good, better, adjust }
    // { op: "clearDay", date: "YYYY-MM-DD" }
    // { op: "addTask", task: { t, who, group, recurrence, days?, weeks?, date? } }
    // { op: "deleteTask", id }

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
    } else if (body.op === "addTask") {
      const err = validateCustomTask(body.task);
      if (err) return json(res, 400, { error: err });
      if (state.customTasks.length >= 200) return json(res, 400, { error: "too_many_tasks" });
      const task = {
        id: "custom-" + crypto.randomBytes(6).toString("hex"),
        t: body.task.t.trim(),
        who: body.task.who,
        group: body.task.group,
        recurrence: body.task.recurrence,
        createdBy: user,
        createdAt: Date.now(),
      };
      if (task.recurrence === "once")   task.date  = body.task.date;
      if (task.recurrence === "weekly") { task.days = body.task.days; task.weeks = body.task.weeks.map(Number); }
      state.customTasks.push(task);
    } else if (body.op === "deleteTask") {
      if (!body.id) return json(res, 400, { error: "missing_id" });
      const before = state.customTasks.length;
      state.customTasks = state.customTasks.filter(t => t.id !== body.id);
      if (state.customTasks.length === before) return json(res, 404, { error: "not_found" });
      // Also purge any checks for that task
      const suffix = "|custom-";
      for (const k of Object.keys(state.checks)) {
        if (k.includes(suffix) && k.endsWith(body.id)) delete state.checks[k];
      }
    } else {
      return json(res, 400, { error: "unknown_op" });
    }

    const saved = await setState(state);
    return json(res, 200, { ...saved, you: user });
  }

  return json(res, 405, { error: "method_not_allowed" });
}
