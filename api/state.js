import {
  getSessionUser, getBearerToken, getState, setState, readBody, json
} from "./_lib.js";
import crypto from "node:crypto";

const VALID_WHO    = new Set(["ruben", "natalia", "both"]);
const VALID_GROUP  = new Set(["comidas", "perros", "limpieza", "baños", "ropa", "exterior", "mensual", "otros"]);
const VALID_DAYS   = new Set(["lunes","martes","miercoles","jueves","viernes","sabado","domingo"]);
const VALID_WEEKS  = new Set([1,2,3,4]);
const VALID_RECUR  = new Set(["once", "daily", "weekly"]);
const VALID_BILL_CATEGORY = new Set(["servicios", "streaming", "seguros", "transporte", "vivienda", "otros"]);
const VALID_PAYER  = new Set(["ruben", "natalia", "both"]);

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

function validateBill(b) {
  if (!b || typeof b !== "object")                         return "invalid_bill";
  if (typeof b.name !== "string" || !b.name.trim())        return "missing_name";
  if (b.name.length > 60)                                  return "name_too_long";
  const amt = Number(b.defaultAmount);
  if (!Number.isFinite(amt) || amt < 0 || amt > 1e7)       return "invalid_amount";
  const day = Number(b.dueDay);
  if (!Number.isInteger(day) || day < 1 || day > 31)       return "invalid_due_day";
  if (!VALID_BILL_CATEGORY.has(b.category))                return "invalid_category";
  if (!VALID_PAYER.has(b.defaultPayer))                    return "invalid_payer";
  if (b.icon && typeof b.icon !== "string")                return "invalid_icon";
  if (b.icon && b.icon.length > 4)                         return "invalid_icon";
  return null;
}

function validateMonth(m) {
  return typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
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
    // { op: "addTask",     task: { t, who, group, recurrence, days?, weeks?, date? } }
    // { op: "deleteTask",  id }
    // { op: "addBill",     bill: { name, defaultAmount, dueDay, category, defaultPayer, icon? } }
    // { op: "editBill",    id, bill: { ... } }
    // { op: "deleteBill",  id }
    // { op: "payBill",     id, month: "YYYY-MM", amount, paidBy?, note? }
    // { op: "unpayBill",   id, month: "YYYY-MM" }

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

    // --- BILLS & PAYMENTS ---
    } else if (body.op === "addBill") {
      const err = validateBill(body.bill);
      if (err) return json(res, 400, { error: err });
      if (state.bills.length >= 100) return json(res, 400, { error: "too_many_bills" });
      const bill = {
        id: "bill-" + crypto.randomBytes(6).toString("hex"),
        name: body.bill.name.trim(),
        defaultAmount: Number(body.bill.defaultAmount),
        dueDay: Number(body.bill.dueDay),
        category: body.bill.category,
        defaultPayer: body.bill.defaultPayer,
        icon: body.bill.icon || "💰",
        createdBy: user,
        createdAt: Date.now(),
      };
      state.bills.push(bill);
    } else if (body.op === "editBill") {
      if (!body.id) return json(res, 400, { error: "missing_id" });
      const err = validateBill(body.bill);
      if (err) return json(res, 400, { error: err });
      const idx = state.bills.findIndex(b => b.id === body.id);
      if (idx < 0) return json(res, 404, { error: "not_found" });
      state.bills[idx] = {
        ...state.bills[idx],
        name: body.bill.name.trim(),
        defaultAmount: Number(body.bill.defaultAmount),
        dueDay: Number(body.bill.dueDay),
        category: body.bill.category,
        defaultPayer: body.bill.defaultPayer,
        icon: body.bill.icon || state.bills[idx].icon || "💰",
        editedBy: user,
        editedAt: Date.now(),
      };
    } else if (body.op === "deleteBill") {
      if (!body.id) return json(res, 400, { error: "missing_id" });
      const before = state.bills.length;
      state.bills = state.bills.filter(b => b.id !== body.id);
      if (state.bills.length === before) return json(res, 404, { error: "not_found" });
      // Purge payment records for this bill across all months
      for (const m of Object.keys(state.payments)) {
        if (state.payments[m] && state.payments[m][body.id]) {
          delete state.payments[m][body.id];
          if (Object.keys(state.payments[m]).length === 0) delete state.payments[m];
        }
      }
    } else if (body.op === "payBill") {
      if (!body.id) return json(res, 400, { error: "missing_id" });
      if (!validateMonth(body.month)) return json(res, 400, { error: "invalid_month" });
      const bill = state.bills.find(b => b.id === body.id);
      if (!bill) return json(res, 404, { error: "not_found" });
      const amt = Number(body.amount);
      if (!Number.isFinite(amt) || amt < 0 || amt > 1e7) return json(res, 400, { error: "invalid_amount" });
      const paidBy = body.paidBy && VALID_PAYER.has(body.paidBy) ? body.paidBy : user;
      const note = typeof body.note === "string" ? body.note.slice(0, 200) : "";
      if (!state.payments[body.month]) state.payments[body.month] = {};
      state.payments[body.month][body.id] = {
        amount: amt,
        paidBy,
        paidAt: Date.now(),
        recordedBy: user,
        note,
      };
    } else if (body.op === "unpayBill") {
      if (!body.id) return json(res, 400, { error: "missing_id" });
      if (!validateMonth(body.month)) return json(res, 400, { error: "invalid_month" });
      if (state.payments[body.month] && state.payments[body.month][body.id]) {
        delete state.payments[body.month][body.id];
        if (Object.keys(state.payments[body.month]).length === 0) delete state.payments[body.month];
      }
    } else {
      return json(res, 400, { error: "unknown_op" });
    }

    const saved = await setState(state);
    return json(res, 200, { ...saved, you: user });
  }

  return json(res, 405, { error: "method_not_allowed" });
}
