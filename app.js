// ========== Constants ==========
const LS_TOKEN      = "chores.token";
const LS_USER       = "chores.user";
const LS_NOTIF      = "chores.notif";
const LS_MINE_ONLY  = "chores.mineOnly";
const LS_CACHE      = "chores.cache";      // offline/last-known state

const POLL_INTERVAL_MS = 8000;
const RETRY_BACKOFF = [500, 1500, 4000, 10000];

// ========== State ==========
const app = {
  token: localStorage.getItem(LS_TOKEN) || null,
  user:  localStorage.getItem(LS_USER)  || null,
  state: null,            // synced server state { checks, weekOverride, reviews }
  mineOnly: localStorage.getItem(LS_MINE_ONLY) === "1",
  viewedWeek: null,       // week shown on "Semana" tab
  currentWeek: 1,         // computed on load
  selectedPickUser: null,
  pollTimer: null,
  pendingOps: [],         // queue for offline operations
};

// ========== Helpers ==========
function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function toast(msg, ms = 2200) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(toast._id);
  toast._id = setTimeout(() => t.classList.add("hidden"), ms);
}

function getEffectiveWeek() {
  const override = app.state?.weekOverride?.week;
  return override || app.currentWeek;
}

// ========== API ==========
async function api(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (app.token) headers.Authorization = `Bearer ${app.token}`;
  const res = await fetch(path, { ...opts, headers });
  if (res.status === 401) {
    // token invalid — force re-login
    handleLogout(true);
    throw new Error("unauthorized");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "request_failed"), { status: res.status, data });
  return data;
}

async function apiLogin(user, password) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "login_failed"), { status: res.status });
  return data;
}

async function syncState() {
  try {
    const data = await api("/api/state");
    app.state = data;
    localStorage.setItem(LS_CACHE, JSON.stringify(data));
    flushPendingOps();
    renderAll();
    return data;
  } catch (e) {
    if (e.message === "unauthorized") return null;
    // offline — fall back to cached state
    if (!app.state) {
      const cached = localStorage.getItem(LS_CACHE);
      if (cached) { try { app.state = JSON.parse(cached); } catch {} }
    }
    return app.state;
  }
}

async function sendOp(op, attempt = 0) {
  try {
    const data = await api("/api/state", { method: "POST", body: JSON.stringify(op) });
    app.state = data;
    localStorage.setItem(LS_CACHE, JSON.stringify(data));
    return data;
  } catch (e) {
    if (e.message === "unauthorized") throw e;
    // queue op for retry
    if (attempt < RETRY_BACKOFF.length) {
      await new Promise(r => setTimeout(r, RETRY_BACKOFF[attempt]));
      return sendOp(op, attempt + 1);
    }
    // still failing — queue for later sync
    app.pendingOps.push(op);
    toast("Sin conexión — se sincronizará después");
    throw e;
  }
}

async function flushPendingOps() {
  if (!app.pendingOps.length) return;
  const ops = app.pendingOps.slice();
  app.pendingOps = [];
  for (const op of ops) {
    try { await sendOp(op); } catch { app.pendingOps.push(op); break; }
  }
}

// ========== Login UI ==========
const loginScreen = $("#login-screen");
const mainApp = $("#app");

function showLogin() {
  loginScreen.classList.remove("hidden");
  mainApp.classList.add("hidden");
  // Reset picker state
  $(".user-picker").classList.remove("hidden");
  $("#login-form").classList.add("hidden");
  $("#login-error").classList.add("hidden");
  $("#password").value = "";
}
function showApp() {
  loginScreen.classList.add("hidden");
  mainApp.classList.remove("hidden");
  startPolling();
}

$$(".user-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const u = btn.dataset.user;
    app.selectedPickUser = u;
    $("#selected-avatar").textContent = USERS[u].name[0];
    $("#selected-avatar").className = "avatar avatar-" + u;
    $("#selected-name").textContent = USERS[u].name;
    $(".user-picker").classList.add("hidden");
    $("#login-form").classList.remove("hidden");
    setTimeout(() => $("#password").focus(), 50);
  });
});

$("#change-user").addEventListener("click", () => {
  $(".user-picker").classList.remove("hidden");
  $("#login-form").classList.add("hidden");
  $("#password").value = "";
  $("#login-error").classList.add("hidden");
});

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pw = $("#password").value;
  if (!app.selectedPickUser) return;
  const btn = $("#login-form button[type=submit]");
  btn.disabled = true;
  btn.textContent = "Entrando...";
  try {
    const { token, user } = await apiLogin(app.selectedPickUser, pw);
    app.token = token;
    app.user = user;
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_USER, user);
    $("#login-error").classList.add("hidden");
    $("#password").value = "";
    await syncState();
    showApp();
  } catch (err) {
    const msg = err.status === 401 ? "Contraseña incorrecta"
              : err.status === 429 ? "Muchos intentos. Espera unos minutos."
              : "Error al conectar. Intenta de nuevo.";
    $("#login-error").textContent = msg;
    $("#login-error").classList.remove("hidden");
    $("#password").select();
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
});

function handleLogout(silent = false) {
  if (app.token) { api("/api/logout", { method: "POST" }).catch(() => {}); }
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_USER);
  app.token = null;
  app.user = null;
  app.selectedPickUser = null;
  app.state = null;
  stopPolling();
  if (!silent) toast("Sesión cerrada");
  showLogin();
}

$("#logout-btn").addEventListener("click", () => handleLogout());

// Auto-login if token present
if (app.token && app.user) {
  showApp();
  syncState();
} else {
  showLogin();
}

// ========== Tabs ==========
$$(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach(t => t.classList.remove("active"));
    $$(".tab-panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    $("#tab-" + tab.dataset.tab).classList.add("active");
    if (tab.dataset.tab === "week" && !app.viewedWeek) {
      renderWeek(getEffectiveWeek());
    }
    if (tab.dataset.tab === "menu") {
      renderMenu(app.viewedMenuWeek || getEffectiveWeek());
    }
    if (tab.dataset.tab === "pagos") {
      renderPagos(app.viewedPagosMonth || currentMonth());
    }
  });
});

// ========== Week selector ==========
$$(".week-btn").forEach(btn => {
  btn.addEventListener("click", () => renderWeek(+btn.dataset.week));
});

// ========== Week override ==========
$("#week-override-toggle")?.addEventListener("click", () => {
  $("#week-override-panel").classList.toggle("open");
});

$$("#week-override-panel .week-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const w = +btn.dataset.week;
    try {
      await sendOp({ op: "setWeek", week: w });
      toast(`Semana cambiada a ${w}`);
      $("#week-override-panel").classList.remove("open");
      renderAll();
    } catch { toast("No se pudo cambiar"); }
  });
});

$("#week-override-reset")?.addEventListener("click", async () => {
  try {
    await sendOp({ op: "setWeek", week: null });
    toast("Volviendo a semana automática");
    $("#week-override-panel").classList.remove("open");
    renderAll();
  } catch { toast("No se pudo cambiar"); }
});

// ========== Mine-only filter ==========
$("#mine-toggle")?.addEventListener("click", () => {
  app.mineOnly = !app.mineOnly;
  localStorage.setItem(LS_MINE_ONLY, app.mineOnly ? "1" : "0");
  $("#mine-toggle").classList.toggle("active", app.mineOnly);
  $("#mine-toggle").textContent = app.mineOnly ? "Solo mías" : "Todas";
  renderToday();
});

// ========== Add task modal ==========
const modal       = $("#task-modal");
const modalForm   = $("#task-form");
const modalError  = $("#tf-error");
const addFab      = $("#add-task-fab");

function openModal() {
  // Reset form
  modalForm.reset();
  // Default who = current user for convenience; default group = otros
  const whoDefault = app.user === "ruben" ? "ruben" : "natalia";
  const whoRadio = modalForm.querySelector(`input[name=who][value=${whoDefault}]`);
  if (whoRadio) whoRadio.checked = true;
  modalForm.querySelector('input[name="group"][value="otros"]').checked = true;
  modalForm.querySelector('input[name="recurrence"][value="once"]').checked = true;
  // Set default date to today
  $("#tf-date").value = dateKey(new Date());
  // Check all weeks by default
  modalForm.querySelectorAll('#tf-weeks input').forEach(cb => cb.checked = true);
  modalForm.querySelectorAll('#tf-days input').forEach(cb => cb.checked = false);
  updateRecurrenceVisibility();
  modalError.classList.add("hidden");
  modal.classList.remove("hidden");
  setTimeout(() => $("#tf-text").focus(), 100);
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}

function updateRecurrenceVisibility() {
  const val = modalForm.querySelector('input[name="recurrence"]:checked')?.value;
  $("#tf-date-field").classList.toggle("hidden", val !== "once");
  $("#tf-weekly-field").classList.toggle("hidden", val !== "weekly");
}

$("#add-task-btn")?.addEventListener("click", openModal);
addFab?.addEventListener("click", openModal);

modal.addEventListener("click", (e) => {
  if (e.target.closest("[data-close-modal]")) closeModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
});

modalForm.querySelectorAll('input[name="recurrence"]').forEach(r => {
  r.addEventListener("change", updateRecurrenceVisibility);
});

modalForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  modalError.classList.add("hidden");

  const fd = new FormData(modalForm);
  const t = $("#tf-text").value.trim();
  const who = fd.get("who");
  const group = fd.get("group");
  const recurrence = fd.get("recurrence");

  if (!t) {
    modalError.textContent = "Pon un nombre a la tarea";
    modalError.classList.remove("hidden");
    return;
  }

  const payload = { t, who, group, recurrence };

  if (recurrence === "once") {
    const d = $("#tf-date").value;
    if (!d) {
      modalError.textContent = "Elige una fecha";
      modalError.classList.remove("hidden");
      return;
    }
    payload.date = d;
  } else if (recurrence === "weekly") {
    const days  = $$('#tf-days input:checked').map(i => i.value);
    const weeks = $$('#tf-weeks input:checked').map(i => Number(i.value));
    if (!days.length)  { modalError.textContent = "Elige al menos un día"; modalError.classList.remove("hidden"); return; }
    if (!weeks.length) { modalError.textContent = "Elige al menos una semana"; modalError.classList.remove("hidden"); return; }
    payload.days = days;
    payload.weeks = weeks;
  }

  const btn = $("#tf-submit");
  btn.disabled = true;
  btn.textContent = "Guardando…";
  try {
    await sendOp({ op: "addTask", task: payload });
    toast("Tarea agregada");
    closeModal();
    renderAll();
  } catch (err) {
    modalError.textContent = "No se pudo guardar. Intenta de nuevo.";
    modalError.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Agregar tarea";
  }
});

// Show FAB only on Today tab
function updateFabVisibility() {
  const todayActive = $("#tab-today").classList.contains("active");
  const loggedIn = !!app.user;
  if (addFab) addFab.classList.toggle("hidden", !(todayActive && loggedIn));
}
// Observe tab switches
$$(".tab").forEach(t => t.addEventListener("click", () => setTimeout(updateFabVisibility, 0)));


// ========== Polling ==========
function startPolling() {
  stopPolling();
  app.pollTimer = setInterval(() => { if (!document.hidden) syncState(); }, POLL_INTERVAL_MS);
}
function stopPolling() {
  if (app.pollTimer) clearInterval(app.pollTimer);
  app.pollTimer = null;
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && app.token) syncState();
});

// ========== Rendering ==========
function renderAll() {
  if (!app.user) return;
  app.currentWeek = getAutoWeekNumber();
  renderHeader();
  renderToday();
  if ($("#tab-week").classList.contains("active") || app.viewedWeek) {
    renderWeek(app.viewedWeek || getEffectiveWeek());
  }
  if (app.viewedMenuWeek) {
    renderMenu(app.viewedMenuWeek);
  }
  if ($("#tab-pagos").classList.contains("active") || app.viewedPagosMonth) {
    renderPagos(app.viewedPagosMonth || currentMonth());
  }
  renderSundayReview();
}

function renderHeader() {
  const u = USERS[app.user];
  const avatar = $("#user-avatar");
  avatar.textContent = u.name[0];
  avatar.className = "avatar avatar-" + app.user;
  $("#hello-text").textContent = `Hola, ${u.name}`;

  const week = getEffectiveWeek();
  const badge = $("#week-badge");
  const override = !!app.state?.weekOverride?.week;
  badge.textContent = `Semana ${week}` + (override ? " ·" : "");
  $("#week-override-indicator").textContent = override ? "manual" : "auto";
  $("#week-override-indicator").className = "override-chip " + (override ? "manual" : "auto");

  // Highlight active week in override panel
  $$("#week-override-panel .week-btn").forEach(b => {
    b.classList.toggle("active", +b.dataset.week === week);
  });

  // Mine-only toggle state
  const mt = $("#mine-toggle");
  if (mt) {
    mt.classList.toggle("active", app.mineOnly);
    mt.textContent = app.mineOnly ? "Solo mías" : "Todas";
  }
}

// Returns a flat list of tasks for a given day (daily + weekly + custom merged).
// Each task gets a stable id that encodes the date for per-day tracking.
function buildDayTasks(week, dayKey, dateStr) {
  const plan = WEEK_PLAN[week];
  const daily = DAILY_TASKS.map(t => ({ ...t, checkKey: `${dateStr}|daily-${t.id}` }));
  const weekly = (plan.days[dayKey] || []).map(t => ({
    ...t,
    checkKey: `${dateStr}|w${week}-${t.id}`,
  }));
  const custom = getCustomTasksFor(
    { dayKey, weekNum: week, dateStr },
    app.state?.customTasks || []
  ).map(t => ({ ...t, checkKey: `${dateStr}|${t.id}` }));
  return { daily, weekly, custom };
}

function renderToday() {
  const now = new Date();
  const dk = dateKey(now);
  const dayK = getTodayKey(now);
  const week = getEffectiveWeek();
  const plan = WEEK_PLAN[week];
  const iAmPrincipal = plan.principal === app.user;

  $("#today-day").textContent = DAY_NAMES[now.getDay()];
  $("#today-date").textContent = formatDateEs(now);
  $("#role-badge").textContent = iAmPrincipal ? "Responsable principal" : "Apoyo";

  const { daily, weekly, custom } = buildDayTasks(week, dayK, dk);
  const all = [...daily, ...weekly, ...custom];

  // Filter mine-only if enabled
  const visible = app.mineOnly
    ? all.filter(t => t.who === app.user || t.who === "both")
    : all;

  // Partition for counts (exclude notes/headers)
  const countable = all.filter(t => t.who !== "note" && t.who !== "header");
  const mineTotal = countable.filter(t => t.who === app.user).length;
  const mineDone  = countable.filter(t => t.who === app.user && app.state?.checks?.[t.checkKey]).length;
  const otherU    = app.user === "ruben" ? "natalia" : "ruben";
  const otherTotal = countable.filter(t => t.who === otherU).length;
  const otherDone  = countable.filter(t => t.who === otherU && app.state?.checks?.[t.checkKey]).length;
  const sharedTotal = countable.filter(t => t.who === "both").length;
  const sharedDone  = countable.filter(t => t.who === "both" && app.state?.checks?.[t.checkKey]).length;

  $("#count-mine").textContent    = `${mineDone}/${mineTotal}`;
  $("#count-other").textContent   = `${otherDone}/${otherTotal}`;
  $("#count-shared").textContent  = `${sharedDone}/${sharedTotal}`;
  $("#label-other").textContent   = USERS[otherU].name;

  const list = $("#today-tasks");
  list.innerHTML = "";

  // Group by `group` field for better organization
  const groups = {
    comidas:  { label: "Comidas", icon: "🍽️", items: [] },
    perros:   { label: "Perros",  icon: "🐕", items: [] },
    limpieza: { label: "Limpieza",icon: "🧹", items: [] },
    baños:    { label: "Baños",   icon: "🚿", items: [] },
    ropa:     { label: "Ropa",    icon: "👕", items: [] },
    exterior: { label: "Exterior",icon: "🌳", items: [] },
    mensual:  { label: "Mensual", icon: "📅", items: [] },
    otros:    { label: "Otros",   icon: "",   items: [] },
  };
  visible.forEach(t => {
    const g = t.group || "otros";
    (groups[g] || groups.otros).items.push(t);
  });

  let groupCount = 0;
  for (const key of Object.keys(groups)) {
    const g = groups[key];
    if (!g.items.length) continue;
    const h = document.createElement("li");
    h.className = "group-header";
    h.innerHTML = `<span>${g.icon ? g.icon + " " : ""}${esc(g.label)}</span>`;
    list.appendChild(h);
    g.items.forEach(t => list.appendChild(buildTaskRow(t)));
    groupCount++;
  }

  if (groupCount === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = app.mineOnly ? "No tienes tareas pendientes hoy 🎉" : "No hay tareas hoy";
    list.appendChild(empty);
  }

  // Today count summary on the section title
  const pending = all.filter(t => t.who !== "note" && t.who !== "header" && !app.state?.checks?.[t.checkKey]).length;
  $("#today-count").textContent = pending === 0 ? "Todo listo 🎉" : `${pending} pendientes`;

  updateProgress();
}

function buildTaskRow(task) {
  const li = document.createElement("li");
  const who = task.who;

  if (who === "note") {
    li.className = "task note";
    li.innerHTML = `<div class="task-text"><strong>Nota:</strong> ${esc(task.t)}</div>`;
    return li;
  }
  if (who === "header") {
    li.className = "task header-row";
    li.innerHTML = `<div class="task-text">${esc(task.t)}</div>`;
    return li;
  }

  const checked = !!app.state?.checks?.[task.checkKey];
  const isMine = who === app.user;
  const isShared = who === "both";
  const mineClass = isMine ? "mine " + app.user : "";
  li.className = "task " + mineClass + (checked ? " done" : "") + (isShared ? " shared" : "");
  li.dataset.key = task.checkKey;

  const whoLabel = isShared ? "Ambos" : USERS[who].name;
  const whoChip  = isShared ? "both"  : who;

  const byInfo = checked && app.state.checks[task.checkKey]?.by
    ? `<span class="by-info">por ${esc(USERS[app.state.checks[task.checkKey].by]?.name || "")}</span>`
    : "";

  const customIndicator = task.customTask ? `<span class="custom-dot" title="Tarea personalizada">✦</span>` : "";
  const deleteBtn = task.customTask
    ? `<button class="task-delete" type="button" aria-label="Eliminar tarea" data-task-id="${esc(task.id)}">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
       </button>`
    : "";

  const subtitleHTML = task.subtitle
    ? `<div class="task-subtitle">${esc(task.subtitle)}</div>`
    : "";

  li.innerHTML = `
    <div class="checkbox" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <div class="task-body">
      <div class="task-text">${customIndicator}${esc(task.t)}</div>
      ${subtitleHTML}
      ${byInfo}
    </div>
    <div class="task-meta">
      <span class="who-chip ${whoChip}">${esc(whoLabel)}</span>
      ${deleteBtn}
    </div>
  `;

  li.addEventListener("click", async (e) => {
    // Ignore clicks on the delete button
    if (e.target.closest(".task-delete")) return;

    // Optimistic: check first, sync second
    const nowChecked = !checked;
    if (!app.state) app.state = { checks: {}, weekOverride: null, reviews: {}, customTasks: [] };
    if (nowChecked) {
      app.state.checks[task.checkKey] = { by: app.user, at: Date.now() };
    } else {
      delete app.state.checks[task.checkKey];
    }
    renderToday();
    try {
      await sendOp({ op: "check", key: task.checkKey, checked: nowChecked });
    } catch {
      // already queued for retry; UI already shows optimistic state
    }
  });

  const delBtn = li.querySelector(".task-delete");
  if (delBtn) {
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("¿Eliminar esta tarea personalizada?")) return;
      const id = delBtn.dataset.taskId;
      // Optimistic removal
      if (app.state?.customTasks) {
        app.state.customTasks = app.state.customTasks.filter(ct => ct.id !== id);
      }
      renderAll();
      try {
        await sendOp({ op: "deleteTask", id });
        toast("Tarea eliminada");
      } catch {
        toast("No se pudo eliminar");
        syncState(); // re-sync to recover real state
      }
    });
  }

  return li;
}

function updateProgress() {
  const rows = $$("#today-tasks .task:not(.note):not(.header-row)");
  const done = rows.filter(r => r.classList.contains("done"));
  const total = rows.length || 1;
  const pct = Math.round((done.length / total) * 100);
  const circ = 2 * Math.PI * 16;
  const offset = circ * (1 - pct / 100);
  const ring = $("#ring-fg");
  if (ring) ring.style.strokeDashoffset = offset.toFixed(2);
  $("#ring-label").textContent = pct + "%";
}

function renderWeek(weekNum) {
  app.viewedWeek = weekNum;
  $$(".week-selector .week-btn").forEach(b => {
    b.classList.toggle("active", +b.dataset.week === weekNum);
  });
  const plan = WEEK_PLAN[weekNum];
  const grid = $("#week-grid");
  grid.innerHTML = "";

  const todayK = getTodayKey();
  const ordered = ["lunes","martes","miercoles","jueves","viernes","sabado","domingo"];

  // For each day, build a representative dateStr (in the future enough we don't
  // render stale "once" tasks from past dates — we want the weekly view to be
  // a template, so ignore "once" tasks here).
  ordered.forEach(dk => {
    const card = document.createElement("div");
    card.className = "day-card" + (dk === todayK && weekNum === getEffectiveWeek() ? " today" : "");
    const items = [...(plan.days[dk] || [])];
    // Merge recurring custom tasks (skip "once" since this view is a template)
    const recurring = (app.state?.customTasks || []).filter(t => t.recurrence !== "once");
    const custom = recurring
      .filter(t => customTaskApplies(t, { dayKey: dk, weekNum, dateStr: "0000-00-00" }))
      .map(t => ({ ...t, customTask: true }));
    const all = [...items, ...custom];

    card.innerHTML = `
      <div class="day-card-header">
        <h3>${dk}</h3>
        ${dk === todayK && weekNum === getEffectiveWeek() ? '<span class="tag">HOY</span>' : ''}
      </div>
      <div class="day-items"></div>
    `;
    const di = card.querySelector(".day-items");
    all.forEach(t => {
      if (t.who === "header") {
        const row = document.createElement("div");
        row.className = "day-item header";
        row.innerHTML = `<strong>${esc(t.t)}</strong>`;
        di.appendChild(row);
        return;
      }
      const row = document.createElement("div");
      row.className = "day-item" + (t.customTask ? " custom" : "");
      const whoName = t.who === "note" ? "" :
                      t.who === "both" ? "Ambos" :
                      USERS[t.who].name;
      const dot = t.customTask ? `<span class="custom-dot">✦</span>` : "";
      row.innerHTML = `
        <span>${dot}${esc(t.t)}</span>
        ${whoName ? `<span class="who-chip ${t.who === "both" ? "both" : t.who}">${esc(whoName)}</span>` : ""}
      `;
      di.appendChild(row);
    });
    grid.appendChild(card);
  });
}

// ========== Menu (meals + shopping) ==========
const MENU_DAY_LABELS = {
  lunes: "Lunes", martes: "Martes", miercoles: "Miércoles",
  jueves: "Jueves", viernes: "Viernes", sabado: "Sábado",
};

function renderMenu(weekNum) {
  app.viewedMenuWeek = weekNum;
  $$("#menu-week-selector .week-btn").forEach(b => {
    b.classList.toggle("active", +b.dataset.menuWeek === weekNum);
  });
  $("#menu-week-hint").textContent = `Semana ${weekNum}`;

  // --- Meal plan ---
  const meals = MEALS[weekNum] || {};
  const mealsRoot = $("#menu-meals");
  mealsRoot.innerHTML = "";
  for (const day of ["lunes","martes","miercoles","jueves","viernes","sabado"]) {
    const d = meals[day];
    if (!d) continue;
    const card = document.createElement("div");
    card.className = "menu-day";
    card.innerHTML = `
      <div class="menu-day-name">${MENU_DAY_LABELS[day]}</div>
      <div class="menu-meal"><span class="menu-meal-tag">🍳 Desayuno</span><span>${esc(d.desayuno || "—")}</span></div>
      <div class="menu-meal"><span class="menu-meal-tag">🍽️ Comida</span><span>${esc(d.comida || "—")}</span></div>
      <div class="menu-meal"><span class="menu-meal-tag">🌙 Cena</span><span>${esc(d.cena || "—")}</span></div>
    `;
    mealsRoot.appendChild(card);
  }

  // --- Shopping list ---
  const iso = isoWeekKey(new Date());
  const shop = SHOPPING[weekNum] || {};
  const shopRoot = $("#menu-shopping");
  shopRoot.innerHTML = "";
  let total = 0, done = 0;

  for (const category of Object.keys(shop)) {
    const items = shop[category];
    const group = document.createElement("div");
    group.className = "shop-group";
    group.innerHTML = `<div class="shop-group-title">${esc(category)}</div>`;
    const list = document.createElement("ul");
    list.className = "shop-list";
    items.forEach(item => {
      total++;
      const key = `${iso}|shop-w${weekNum}-${shopSlug(item)}`;
      const checked = !!app.state?.checks?.[key];
      if (checked) done++;
      const li = document.createElement("li");
      li.className = "shop-item" + (checked ? " done" : "");
      li.dataset.key = key;
      li.innerHTML = `
        <div class="checkbox" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="shop-item-text">${esc(item)}</div>
      `;
      li.addEventListener("click", async () => {
        const nowChecked = !li.classList.contains("done");
        li.classList.toggle("done");
        if (!app.state) app.state = { checks: {}, weekOverride: null, reviews: {}, customTasks: [] };
        if (nowChecked) app.state.checks[key] = { by: app.user, at: Date.now() };
        else delete app.state.checks[key];
        // Update counter immediately (optimistic)
        renderShopCounter();
        try { await sendOp({ op: "check", key, checked: nowChecked }); }
        catch {}
      });
      list.appendChild(li);
    });
    group.appendChild(list);
    shopRoot.appendChild(group);
  }

  renderShopCounter(done, total);

  // Stash for counter updates
  shopRoot.dataset.total = total;
  shopRoot.dataset.isoWeek = iso;
  shopRoot.dataset.weekNum = weekNum;
}

function renderShopCounter(done, total) {
  const el = $("#shop-progress");
  if (!el) return;
  if (done == null || total == null) {
    // Recalculate from DOM
    const all = $$("#menu-shopping .shop-item");
    total = all.length;
    done = all.filter(i => i.classList.contains("done")).length;
  }
  el.textContent = `${done}/${total}`;
}

// Wire up menu week selector
$$("#menu-week-selector .week-btn").forEach(btn => {
  btn.addEventListener("click", () => renderMenu(+btn.dataset.menuWeek));
});

// ========== Pagos (monthly bills) ==========
const MONTH_NAMES_CAP = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DUE_SOON_DAYS = 3;

function currentMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
}
function monthOffset(monthStr, delta) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function monthTitle(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  return `${MONTH_NAMES_CAP[m-1]} ${y}`;
}
function lastDayOfMonth(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
function fmtMoney(n) {
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(Number(n) || 0);
  } catch {
    return `$${Math.round(Number(n) || 0)}`;
  }
}

// Status per bill for a given month.
// Returns: "paid" | "overdue" | "due-soon" | "pending" | "future"
function billStatus(bill, monthStr, payments, today = new Date()) {
  const pay = payments?.[monthStr]?.[bill.id];
  if (pay) return "paid";
  const cm = currentMonth(today);
  if (monthStr < cm) return "overdue"; // past month, unpaid
  if (monthStr > cm) return "future";
  // Same month: compare dueDay to today.getDate()
  const capped = Math.min(bill.dueDay, lastDayOfMonth(monthStr));
  const daysUntilDue = capped - today.getDate();
  if (daysUntilDue < 0)             return "overdue";
  if (daysUntilDue <= DUE_SOON_DAYS) return "due-soon";
  return "pending";
}

function statusLabel(status, dueDay, today = new Date(), monthStr) {
  const cm = currentMonth(today);
  const capped = monthStr ? Math.min(dueDay, lastDayOfMonth(monthStr)) : dueDay;
  if (status === "paid")      return { label: "Pagado",      tone: "ok" };
  if (status === "overdue") {
    if (monthStr && monthStr < cm) return { label: "Sin pagar", tone: "bad" };
    return { label: "Vencido", tone: "bad" };
  }
  if (status === "due-soon") {
    const diff = capped - today.getDate();
    return { label: diff === 0 ? "Vence hoy" : `Vence en ${diff} día${diff===1?"":"s"}`, tone: "warn" };
  }
  if (status === "future")    return { label: `Vence día ${capped}`,         tone: "muted" };
  return { label: `Vence día ${capped}`, tone: "muted" };
}

function renderPagos(monthStr) {
  app.viewedPagosMonth = monthStr;

  $("#pagos-month-title").textContent = monthTitle(monthStr);
  const isCurrent = monthStr === currentMonth();
  $("#pagos-jump-today").classList.toggle("hidden", isCurrent);

  const bills = app.state?.bills || [];
  const payments = app.state?.payments || {};
  const today = new Date();

  // Filter bills that existed at or before this month
  const monthDate = new Date(...monthStr.split("-").map(Number).concat([1]));
  monthDate.setMonth(monthDate.getMonth() + 1); // first of next month
  const visibleBills = bills.filter(b => !b.createdAt || b.createdAt < monthDate.getTime());

  // Sort: overdue first, then due-soon, then pending by dueDay, then paid last
  const statusOrder = { "overdue": 0, "due-soon": 1, "pending": 2, "future": 3, "paid": 4 };
  const enriched = visibleBills.map(b => ({
    bill: b,
    status: billStatus(b, monthStr, payments, today),
    payment: payments[monthStr]?.[b.id],
  }));
  enriched.sort((a, b) => {
    const sd = statusOrder[a.status] - statusOrder[b.status];
    if (sd !== 0) return sd;
    return a.bill.dueDay - b.bill.dueDay;
  });

  // Totals / summary
  const totalExpected = visibleBills.reduce((s, b) => {
    const pay = payments[monthStr]?.[b.id];
    return s + (pay ? Number(pay.amount) : Number(b.defaultAmount));
  }, 0);
  const totalPaid = visibleBills.reduce((s, b) => {
    const pay = payments[monthStr]?.[b.id];
    return s + (pay ? Number(pay.amount) : 0);
  }, 0);
  const paidCount = visibleBills.filter(b => payments[monthStr]?.[b.id]).length;
  $("#pagos-paid-amount").textContent = fmtMoney(totalPaid);
  $("#pagos-total-sub").textContent   = `de ${fmtMoney(totalExpected)} · ${paidCount}/${visibleBills.length} cuentas`;
  $("#pagos-count").textContent       = visibleBills.length === 1 ? "1 cuenta" : `${visibleBills.length} cuentas`;

  // Progress ring
  const pct = visibleBills.length ? Math.round((paidCount / visibleBills.length) * 100) : 0;
  const circ = 2 * Math.PI * 16;
  const ring = $("#pagos-ring-fg");
  if (ring) ring.style.strokeDashoffset = (circ * (1 - pct/100)).toFixed(2);
  $("#pagos-ring-label").textContent = pct + "%";

  // List
  const list = $("#pagos-list");
  list.innerHTML = "";
  if (!visibleBills.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No hay cuentas. Agrega una para empezar.";
    list.appendChild(empty);
  } else {
    enriched.forEach(({ bill, status, payment }) => {
      list.appendChild(buildBillRow(bill, status, payment, monthStr, today));
    });
  }

  renderBalance(visibleBills, payments, monthStr);
}

function buildBillRow(bill, status, payment, monthStr, today) {
  const li = document.createElement("li");
  li.className = `bill-row bill-${status}`;
  li.dataset.billId = bill.id;

  const { label: statusTxt, tone } = statusLabel(status, bill.dueDay, today, monthStr);
  const payer = bill.defaultPayer === "both" ? "Ambos" : USERS[bill.defaultPayer]?.name || "—";
  const payerChip = bill.defaultPayer === "both" ? "both" : bill.defaultPayer;

  if (status === "paid" && payment) {
    const by = payment.paidBy === "both" ? "Ambos" : USERS[payment.paidBy]?.name || "—";
    const date = new Date(payment.paidAt);
    const dateStr = `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
    li.innerHTML = `
      <div class="bill-icon">${esc(bill.icon || "💰")}</div>
      <div class="bill-body">
        <div class="bill-top">
          <span class="bill-name">${esc(bill.name)}</span>
          <span class="bill-status ${tone}">${esc(statusTxt)}</span>
        </div>
        <div class="bill-sub">${fmtMoney(payment.amount)} · ${esc(by)} · ${esc(dateStr)}${payment.note ? ` · ${esc(payment.note)}` : ""}</div>
      </div>
      <div class="bill-actions">
        <button class="bill-action-btn edit-btn" type="button" aria-label="Editar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="bill-action-btn unpay-btn" type="button" aria-label="Deshacer pago">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
        </button>
      </div>
    `;
  } else {
    li.innerHTML = `
      <div class="bill-icon">${esc(bill.icon || "💰")}</div>
      <div class="bill-body">
        <div class="bill-top">
          <span class="bill-name">${esc(bill.name)}</span>
          <span class="bill-status ${tone}">${esc(statusTxt)}</span>
        </div>
        <div class="bill-sub">
          <span class="bill-amount">${fmtMoney(bill.defaultAmount)}</span>
          <span class="who-chip ${payerChip}">${esc(payer)}</span>
        </div>
      </div>
      <div class="bill-actions">
        <button class="bill-action-btn edit-btn" type="button" aria-label="Editar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="bill-pay-btn" type="button">Pagar</button>
      </div>
    `;
  }

  li.querySelector(".edit-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    openBillModal(bill);
  });

  const payBtn = li.querySelector(".bill-pay-btn");
  if (payBtn) {
    payBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPayModal(bill, monthStr);
    });
  }

  const unpayBtn = li.querySelector(".unpay-btn");
  if (unpayBtn) {
    unpayBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm("¿Deshacer este pago?")) return;
      try {
        await sendOp({ op: "unpayBill", id: bill.id, month: monthStr });
        toast("Pago deshecho");
        renderPagos(monthStr);
      } catch {
        toast("No se pudo deshacer");
      }
    });
  }

  return li;
}

// Simple balance tracker: what each person paid out vs the fair share.
// Fair share for "both" bills = 50/50; solo bills belong to that person.
function renderBalance(bills, payments, monthStr) {
  const panel = $("#pagos-balance");
  const m = payments[monthStr] || {};
  if (!Object.keys(m).length || !bills.length) {
    panel.classList.add("hidden");
    return;
  }
  let rubenPaid = 0, nataliaPaid = 0, sharedPaid = 0;
  let rubenOwes = 0, nataliaOwes = 0;

  for (const b of bills) {
    const pay = m[b.id];
    if (!pay) continue;
    const amount = Number(pay.amount);
    // Who actually paid
    if (pay.paidBy === "ruben") rubenPaid += amount;
    else if (pay.paidBy === "natalia") nataliaPaid += amount;
    else sharedPaid += amount;
    // Fair share based on the bill's default payer
    if (b.defaultPayer === "both") {
      // half belongs to each
      rubenOwes += amount / 2;
      nataliaOwes += amount / 2;
    } else {
      // solo bill — fair share falls on defaultPayer
      if (b.defaultPayer === "ruben") rubenOwes += amount;
      else nataliaOwes += amount;
    }
  }

  const rubenNet   = rubenPaid   - rubenOwes;   // positive = paid more than share
  const nataliaNet = nataliaPaid - nataliaOwes;

  $("#balance-ruben-name").textContent   = "Rubén";
  $("#balance-natalia-name").textContent = "Natalia";
  $("#balance-ruben").textContent   = (rubenNet   >= 0 ? "+" : "") + fmtMoney(rubenNet);
  $("#balance-natalia").textContent = (nataliaNet >= 0 ? "+" : "") + fmtMoney(nataliaNet);
  $("#balance-shared").textContent  = fmtMoney(sharedPaid);
  panel.classList.remove("hidden");
}

// --- Month navigation ---
$("#pagos-prev")?.addEventListener("click", () => {
  renderPagos(monthOffset(app.viewedPagosMonth || currentMonth(), -1));
});
$("#pagos-next")?.addEventListener("click", () => {
  renderPagos(monthOffset(app.viewedPagosMonth || currentMonth(), +1));
});
$("#pagos-jump-today")?.addEventListener("click", () => renderPagos(currentMonth()));

// --- Bill modal (add / edit) ---
const billModal = $("#bill-modal");
const billForm  = $("#bill-form");

function openBillModal(existing = null) {
  billForm.reset();
  $("#bf-id").value = existing?.id || "";
  $("#bill-modal-title").textContent = existing ? "Editar cuenta" : "Nueva cuenta";
  $("#bf-submit").textContent = existing ? "Guardar cambios" : "Agregar cuenta";
  $("#bf-delete").classList.toggle("hidden", !existing);

  if (existing) {
    $("#bf-name").value = existing.name;
    $("#bf-amount").value = existing.defaultAmount;
    $("#bf-dueday").value = existing.dueDay;
    const catInput = billForm.querySelector(`input[name="bcat"][value="${existing.category}"]`);
    if (catInput) catInput.checked = true;
    const payerInput = billForm.querySelector(`input[name="bpayer"][value="${existing.defaultPayer}"]`);
    if (payerInput) payerInput.checked = true;
    const iconInput = billForm.querySelector(`input[name="bicon"][value="${existing.icon || "💰"}"]`);
    if (iconInput) iconInput.checked = true;
  } else {
    // Smart defaults
    billForm.querySelector('input[name="bcat"][value="servicios"]').checked = true;
    billForm.querySelector('input[name="bpayer"][value="both"]').checked = true;
    billForm.querySelector('input[name="bicon"][value="💰"]').checked = true;
  }

  $("#bf-error").classList.add("hidden");
  billModal.classList.remove("hidden");
  setTimeout(() => $("#bf-name").focus(), 100);
  document.body.style.overflow = "hidden";
}

function closeBillModal() {
  billModal.classList.add("hidden");
  document.body.style.overflow = "";
}

billModal.addEventListener("click", (e) => {
  if (e.target.closest("[data-close-modal]")) closeBillModal();
});

$("#add-bill-btn")?.addEventListener("click", () => openBillModal());

$("#bf-delete")?.addEventListener("click", async () => {
  const id = $("#bf-id").value;
  if (!id) return;
  if (!confirm("¿Eliminar esta cuenta? Se borrará su historial de pagos.")) return;
  try {
    await sendOp({ op: "deleteBill", id });
    toast("Cuenta eliminada");
    closeBillModal();
    renderPagos(app.viewedPagosMonth || currentMonth());
  } catch {
    toast("No se pudo eliminar");
  }
});

billForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#bf-error");
  err.classList.add("hidden");

  const fd = new FormData(billForm);
  const id = $("#bf-id").value;
  const bill = {
    name: $("#bf-name").value.trim(),
    defaultAmount: Number($("#bf-amount").value),
    dueDay: Number($("#bf-dueday").value),
    category: fd.get("bcat"),
    defaultPayer: fd.get("bpayer"),
    icon: fd.get("bicon") || "💰",
  };
  if (!bill.name) { err.textContent = "Pon un nombre"; err.classList.remove("hidden"); return; }
  if (!(bill.defaultAmount >= 0)) { err.textContent = "Monto inválido"; err.classList.remove("hidden"); return; }
  if (!(bill.dueDay >= 1 && bill.dueDay <= 31)) { err.textContent = "Día inválido (1–31)"; err.classList.remove("hidden"); return; }

  const btn = $("#bf-submit");
  btn.disabled = true;
  btn.textContent = "Guardando…";
  try {
    if (id) await sendOp({ op: "editBill", id, bill });
    else    await sendOp({ op: "addBill", bill });
    toast(id ? "Cuenta actualizada" : "Cuenta agregada");
    closeBillModal();
    renderPagos(app.viewedPagosMonth || currentMonth());
  } catch {
    err.textContent = "No se pudo guardar";
    err.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = id ? "Guardar cambios" : "Agregar cuenta";
  }
});

// --- Pay modal ---
const payModal = $("#pay-modal");
const payForm  = $("#pay-form");

function openPayModal(bill, monthStr) {
  payForm.reset();
  $("#pf-bill-id").value  = bill.id;
  $("#pf-month").value    = monthStr;
  $("#pf-icon").textContent     = bill.icon || "💰";
  $("#pf-bill-name").textContent = bill.name;
  $("#pf-month-label").textContent = monthTitle(monthStr);
  $("#pf-amount").value = bill.defaultAmount;
  const payer = bill.defaultPayer;
  const payerInput = payForm.querySelector(`input[name="paidBy"][value="${payer}"]`);
  if (payerInput) payerInput.checked = true;
  $("#pf-error").classList.add("hidden");
  payModal.classList.remove("hidden");
  setTimeout(() => $("#pf-amount").select(), 100);
  document.body.style.overflow = "hidden";
}
function closePayModal() {
  payModal.classList.add("hidden");
  document.body.style.overflow = "";
}

payModal.addEventListener("click", (e) => {
  if (e.target.closest("[data-close-modal]")) closePayModal();
});

payForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#pf-error");
  err.classList.add("hidden");
  const id = $("#pf-bill-id").value;
  const month = $("#pf-month").value;
  const fd = new FormData(payForm);
  const amount = Number($("#pf-amount").value);
  const paidBy = fd.get("paidBy") || "both";
  const note   = $("#pf-note").value.trim();

  if (!(amount >= 0)) {
    err.textContent = "Monto inválido";
    err.classList.remove("hidden");
    return;
  }
  const btn = $("#pf-submit");
  btn.disabled = true;
  btn.textContent = "Guardando…";
  try {
    await sendOp({ op: "payBill", id, month, amount, paidBy, note });
    toast("Pago registrado");
    closePayModal();
    renderPagos(month);
  } catch {
    err.textContent = "No se pudo guardar";
    err.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = "Marcar pagada";
  }
});

// ========== Sunday review ==========
function renderSundayReview() {
  const now = new Date();
  const isSunday = now.getDay() === 0;
  const card = $("#sunday-review");
  if (!card) return;
  if (!isSunday) { card.classList.add("hidden"); return; }
  card.classList.remove("hidden");

  const wk = isoWeekKey(now);
  const existing = app.state?.reviews?.[wk];
  if (existing) {
    $("#review-good").value = existing.good || "";
    $("#review-better").value = existing.better || "";
    $("#review-adjust").value = existing.adjust || "";
    $("#review-status").textContent = `Guardado por ${USERS[existing.by]?.name || ""}`;
  } else {
    $("#review-status").textContent = "";
  }
}

$("#review-save")?.addEventListener("click", async () => {
  const wk = isoWeekKey(new Date());
  try {
    await sendOp({
      op: "review",
      isoWeek: wk,
      good: $("#review-good").value,
      better: $("#review-better").value,
      adjust: $("#review-adjust").value,
    });
    toast("Revisión guardada");
    renderSundayReview();
  } catch { toast("No se pudo guardar"); }
});

// ========== Notifications ==========
const notifBtn = $("#notif-btn");
function updateNotifBtn() {
  const on = localStorage.getItem(LS_NOTIF) === "on" && Notification.permission === "granted";
  notifBtn.classList.toggle("active", on);
}
updateNotifBtn();

notifBtn.addEventListener("click", async () => {
  if (!("Notification" in window)) return toast("Tu navegador no soporta notificaciones");
  if (Notification.permission === "granted") {
    const on = localStorage.getItem(LS_NOTIF) === "on";
    localStorage.setItem(LS_NOTIF, on ? "off" : "on");
    toast(on ? "Notificaciones desactivadas" : "Notificaciones activadas");
    if (!on) scheduleReminders();
    updateNotifBtn();
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    localStorage.setItem(LS_NOTIF, "on");
    toast("¡Notificaciones activadas!");
    await ensureSW();
    scheduleReminders();
    showLocalNotif("¡Listo!", "Te recordaremos tus tareas ✨");
  } else toast("Permiso denegado");
  updateNotifBtn();
});

async function ensureSW() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
    // When a new worker takes over, reload once so the user sees the new version
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
    reg.update().catch(() => {});
    return reg;
  } catch (e) {
    return null;
  }
}
async function showLocalNotif(title, body) {
  const reg = await navigator.serviceWorker.getRegistration();
  const opts = { body, icon: "./icon.svg", badge: "./icon.svg", tag: "chores-" + Date.now() };
  if (reg?.showNotification) reg.showNotification(title, opts);
  else if ("Notification" in window) new Notification(title, opts);
}

async function notifyBillsDueSoon() {
  if (!app.user) return;
  if (localStorage.getItem(LS_NOTIF) !== "on") return;
  const bills = app.state?.bills || [];
  if (!bills.length) return;
  const today = new Date();
  const cm = currentMonth(today);
  const payments = app.state?.payments || {};
  const urgent = bills.filter(b => {
    if (payments[cm]?.[b.id]) return false; // already paid this month
    const capped = Math.min(b.dueDay, lastDayOfMonth(cm));
    const diff = capped - today.getDate();
    return diff >= 0 && diff <= DUE_SOON_DAYS;
  });
  const overdue = bills.filter(b => {
    if (payments[cm]?.[b.id]) return false;
    const capped = Math.min(b.dueDay, lastDayOfMonth(cm));
    return today.getDate() > capped;
  });
  if (overdue.length) {
    showLocalNotif(
      `${overdue.length} cuenta${overdue.length===1?" vencida":"s vencidas"}`,
      overdue.map(b => b.name).slice(0, 3).join(", ")
    );
  } else if (urgent.length) {
    showLocalNotif(
      `${urgent.length} cuenta${urgent.length===1?" por pagar":"s por pagar pronto"}`,
      urgent.map(b => `${b.name} (día ${b.dueDay})`).slice(0, 3).join(", ")
    );
  }
}

function scheduleReminders() {
  if (localStorage.getItem(LS_NOTIF) !== "on") return;
  const times = [{ h: 9, m: 0 }, { h: 18, m: 0 }];
  times.forEach(({ h, m }) => {
    const next = new Date();
    next.setHours(h, m, 0, 0);
    if (next <= new Date()) next.setDate(next.getDate() + 1);
    const ms = next - new Date();
    setTimeout(async () => {
      await syncState();
      const dk = dateKey(new Date());
      const week = getEffectiveWeek();
      const dayK = getTodayKey(new Date());
      const { daily, weekly } = buildDayTasks(week, dayK, dk);
      const mine = [...daily, ...weekly].filter(t =>
        (t.who === app.user || t.who === "both") && !app.state?.checks?.[t.checkKey]
      );
      if (mine.length > 0 && app.user) {
        showLocalNotif(
          h === 9 ? `Buenos días, ${USERS[app.user].name}` : "Recordatorio de tareas",
          `Te quedan ${mine.length} tareas hoy. ¡Tú puedes!`
        );
      }
      // Morning reminder also checks upcoming bills
      if (h === 9 && app.user) notifyBillsDueSoon();
      scheduleReminders();
    }, Math.min(ms, 2147483000));
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => ensureSW());
}
if (localStorage.getItem(LS_NOTIF) === "on" && Notification.permission === "granted") {
  scheduleReminders();
}

// Refresh at midnight
function scheduleMidnightRefresh() {
  const next = new Date();
  next.setHours(24, 0, 5, 0);
  setTimeout(async () => {
    await syncState();
    renderAll();
    scheduleMidnightRefresh();
  }, next - new Date());
}
scheduleMidnightRefresh();

// Online/offline
window.addEventListener("online", () => { toast("Conectado"); flushPendingOps(); syncState(); });
window.addEventListener("offline", () => toast("Sin conexión"));
