// ====== State ======
const STORAGE_USER = "chores.currentUser";
const STORAGE_CHECKS = "chores.checks";   // { "YYYY-MM-DD|taskId": true }
const STORAGE_NOTIF = "chores.notif";     // "on" | "off"

let state = {
  user: null,        // "ruben" | "natalia"
  currentWeek: getCurrentWeekNumber(),
  viewedWeek: getCurrentWeekNumber(),
  selectedPickUser: null,
  checks: loadChecks(),
};

function loadChecks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_CHECKS) || "{}"); }
  catch { return {}; }
}
function saveChecks() {
  localStorage.setItem(STORAGE_CHECKS, JSON.stringify(state.checks));
}
function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// ====== Login ======
const loginScreen = document.getElementById("login-screen");
const app = document.getElementById("app");

function showLogin() {
  loginScreen.classList.remove("hidden");
  app.classList.add("hidden");
}
function showApp() {
  loginScreen.classList.add("hidden");
  app.classList.remove("hidden");
  renderAll();
}

document.querySelectorAll(".user-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const user = btn.dataset.user;
    state.selectedPickUser = user;
    const u = USERS[user];
    document.getElementById("selected-avatar").textContent = u.name[0];
    document.getElementById("selected-avatar").className = "avatar avatar-" + user;
    document.getElementById("selected-name").textContent = u.name;
    document.querySelector(".user-picker").classList.add("hidden");
    document.getElementById("login-form").classList.remove("hidden");
    setTimeout(() => document.getElementById("password").focus(), 50);
  });
});

document.getElementById("change-user").addEventListener("click", () => {
  document.querySelector(".user-picker").classList.remove("hidden");
  document.getElementById("login-form").classList.add("hidden");
  document.getElementById("password").value = "";
  document.getElementById("login-error").classList.add("hidden");
});

document.getElementById("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const pw = document.getElementById("password").value;
  const target = USERS[state.selectedPickUser];
  if (!target) return;
  if (pw === target.password) {
    state.user = state.selectedPickUser;
    localStorage.setItem(STORAGE_USER, state.user);
    document.getElementById("password").value = "";
    document.getElementById("login-error").classList.add("hidden");
    showApp();
  } else {
    document.getElementById("login-error").classList.remove("hidden");
    document.getElementById("password").select();
  }
});

// Auto-login
const saved = localStorage.getItem(STORAGE_USER);
if (saved && USERS[saved]) {
  state.user = saved;
  showApp();
} else {
  showLogin();
}

document.getElementById("logout-btn").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_USER);
  state.user = null;
  state.selectedPickUser = null;
  document.querySelector(".user-picker").classList.remove("hidden");
  document.getElementById("login-form").classList.add("hidden");
  showLogin();
});

// ====== Tabs ======
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
  });
});

// ====== Render ======
function renderAll() {
  renderHeader();
  renderToday();
  renderWeek(state.viewedWeek);
}

function renderHeader() {
  const u = USERS[state.user];
  const avatar = document.getElementById("user-avatar");
  avatar.textContent = u.name[0];
  avatar.className = "avatar avatar-" + state.user;
  document.getElementById("hello-text").textContent = `Hola, ${u.name}`;
  document.getElementById("week-badge").textContent = `Semana ${state.currentWeek}`;
}

// Which color accent for "mine" rows
function mineClass(who) {
  return who === state.user ? "mine " + state.user : "";
}

// Build a task row
function buildTaskRow(task, opts = {}) {
  const { dayK = getTodayKey(), showWho = true, allowCheck = true, taskIdPrefix = "" } = opts;
  const li = document.createElement("li");
  const who = task.who;

  // Header / note rows
  if (who === "note") {
    li.className = "task note";
    li.innerHTML = `<div class="task-text"><strong>Nota:</strong> ${escape(task.t)}</div>`;
    return li;
  }
  if (task.header) {
    li.className = "task header-row";
    li.innerHTML = `<div class="task-text">${escape(task.t)}</div>`;
    return li;
  }

  const taskId = `${taskIdPrefix}${slug(task.t)}`;
  const key = `${dateKey()}|${taskId}`;
  const checked = !!state.checks[key];

  li.className = "task " + mineClass(who) + (checked ? " done" : "");
  li.dataset.key = key;

  const whoLabel = who === "both" ? "Ambos" : (USERS[who] ? USERS[who].name : "");
  const whoChipClass = who === "both" ? "both" : who;

  li.innerHTML = `
    <div class="checkbox" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <div class="task-text">${escape(task.t)}</div>
    ${showWho ? `<div class="task-meta"><span class="who-chip ${whoChipClass}">${escape(whoLabel)}</span></div>` : ""}
  `;

  if (allowCheck) {
    li.addEventListener("click", () => {
      if (state.checks[key]) delete state.checks[key];
      else state.checks[key] = true;
      saveChecks();
      li.classList.toggle("done");
      updateProgress();
    });
  }

  return li;
}

function slug(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
}
function escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function renderToday() {
  const today = new Date();
  const dayKey = getTodayKey(today);
  document.getElementById("today-day").textContent = DAY_NAMES[today.getDay()];
  document.getElementById("today-date").textContent = formatDateEs(today);

  const plan = WEEK_PLAN[state.currentWeek];
  const isPrincipal = plan.principal === state.user;
  document.getElementById("role-badge").textContent = isPrincipal ? "Responsable principal" : "Apoyo";

  // Today tasks
  const list = document.getElementById("today-tasks");
  list.innerHTML = "";
  const dayTasks = plan.days[dayKey] || [];
  dayTasks.forEach(t => {
    list.appendChild(buildTaskRow(t, { dayK: dayKey, taskIdPrefix: `w${state.currentWeek}-${dayKey}-` }));
  });
  document.getElementById("today-count").textContent = `${dayTasks.filter(t => t.who !== "note" && !t.header).length} tareas`;

  // Daily routine (not day-specific) — show as reminders
  const daily = document.getElementById("daily-tasks");
  daily.innerHTML = "";
  DAILY_TASKS.forEach(t => {
    const row = {
      t: t.text,
      who: t.who === "rotates" ? "both" : "both",
    };
    daily.appendChild(buildTaskRow(row, { taskIdPrefix: "daily-" }));
  });

  updateProgress();
}

function updateProgress() {
  const tasks = document.querySelectorAll("#today-tasks .task:not(.note):not(.header-row)");
  const done = document.querySelectorAll("#today-tasks .task.done:not(.note):not(.header-row)");
  const total = tasks.length || 1;
  const pct = Math.round((done.length / total) * 100);
  const circ = 2 * Math.PI * 16; // 100.53
  const offset = circ * (1 - pct / 100);
  const ring = document.getElementById("ring-fg");
  if (ring) ring.style.strokeDashoffset = offset.toFixed(2);
  const label = document.getElementById("ring-label");
  if (label) label.textContent = pct + "%";
}

function renderWeek(weekNum) {
  state.viewedWeek = weekNum;
  document.querySelectorAll(".week-btn").forEach(b => {
    b.classList.toggle("active", +b.dataset.week === weekNum);
  });
  const plan = WEEK_PLAN[weekNum];
  const grid = document.getElementById("week-grid");
  grid.innerHTML = "";

  const todayKey = getTodayKey();
  const orderedDays = ["lunes","martes","miercoles","jueves","viernes","sabado","domingo"];

  orderedDays.forEach(dk => {
    const card = document.createElement("div");
    card.className = "day-card" + (dk === todayKey && weekNum === state.currentWeek ? " today" : "");
    const items = plan.days[dk] || [];
    card.innerHTML = `
      <div class="day-card-header">
        <h3>${dk}</h3>
        ${dk === todayKey && weekNum === state.currentWeek ? '<span class="tag">HOY</span>' : ''}
      </div>
      <div class="day-items"></div>
    `;
    const di = card.querySelector(".day-items");
    items.forEach(t => {
      if (t.header) return;
      const row = document.createElement("div");
      row.className = "day-item";
      const whoName = t.who === "note" ? "" :
                      t.who === "both" ? "Ambos" :
                      (USERS[t.who] ? USERS[t.who].name : "");
      row.innerHTML = `
        <span>${escape(t.t)}</span>
        ${whoName ? `<span class="who-chip ${t.who === "both" ? "both" : t.who}">${escape(whoName)}</span>` : ""}
      `;
      di.appendChild(row);
    });
    grid.appendChild(card);
  });
}

document.querySelectorAll(".week-btn").forEach(btn => {
  btn.addEventListener("click", () => renderWeek(+btn.dataset.week));
});

// ====== Toast ======
function toast(message, ms = 2400) {
  const t = document.getElementById("toast");
  t.textContent = message;
  t.classList.remove("hidden");
  clearTimeout(toast._id);
  toast._id = setTimeout(() => t.classList.add("hidden"), ms);
}

// ====== Notifications ======
const notifBtn = document.getElementById("notif-btn");
function updateNotifBtn() {
  const enabled = localStorage.getItem(STORAGE_NOTIF) === "on" && Notification.permission === "granted";
  notifBtn.classList.toggle("active", enabled);
}
updateNotifBtn();

notifBtn.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    toast("Tu navegador no soporta notificaciones");
    return;
  }
  if (Notification.permission === "granted") {
    const isOn = localStorage.getItem(STORAGE_NOTIF) === "on";
    localStorage.setItem(STORAGE_NOTIF, isOn ? "off" : "on");
    toast(isOn ? "Notificaciones desactivadas" : "Notificaciones activadas");
    if (!isOn) scheduleReminders();
    updateNotifBtn();
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    localStorage.setItem(STORAGE_NOTIF, "on");
    toast("¡Notificaciones activadas!");
    await registerSW();
    scheduleReminders();
    // Welcome notification
    showLocalNotification("¡Listo!", "Te recordaremos tus tareas del día ✨");
  } else {
    toast("Permiso denegado");
  }
  updateNotifBtn();
});

async function registerSW() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("./sw.js");
    return reg;
  } catch (e) {
    console.warn("SW registration failed", e);
    return null;
  }
}

async function showLocalNotification(title, body) {
  const reg = await navigator.serviceWorker.getRegistration();
  const opts = { body, icon: "./icon.svg", badge: "./icon.svg", tag: "chores-" + Date.now() };
  if (reg && reg.showNotification) {
    reg.showNotification(title, opts);
  } else if ("Notification" in window) {
    new Notification(title, opts);
  }
}

// Schedule reminders via setTimeout — fires morning + evening reminders while tab is open,
// and a daily check via the SW when closed.
function scheduleReminders() {
  if (localStorage.getItem(STORAGE_NOTIF) !== "on") return;

  const pending = document.querySelectorAll("#today-tasks .task:not(.done):not(.note):not(.header-row)").length;
  const u = USERS[state.user];

  // Next reminder times: 9am and 6pm local
  const times = [{ h: 9, m: 0 }, { h: 18, m: 0 }];
  times.forEach(({ h, m }) => {
    const next = new Date();
    next.setHours(h, m, 0, 0);
    if (next <= new Date()) next.setDate(next.getDate() + 1);
    const ms = next - new Date();
    setTimeout(() => {
      const left = document.querySelectorAll("#today-tasks .task:not(.done):not(.note):not(.header-row)").length;
      if (left > 0) {
        showLocalNotification(
          h === 9 ? `Buenos días, ${u.name}` : `Recordatorio de tareas`,
          `Te quedan ${left} tareas hoy. ¡Tú puedes!`
        );
      }
      scheduleReminders(); // reschedule for next day
    }, Math.min(ms, 2147483000));
  });
}

// Register SW quietly for offline use even without notifications
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => registerSW());
}

// Re-render at midnight so "today" updates
function scheduleMidnightRefresh() {
  const next = new Date();
  next.setHours(24, 0, 5, 0);
  setTimeout(() => {
    state.currentWeek = getCurrentWeekNumber();
    state.viewedWeek = state.currentWeek;
    renderAll();
    scheduleMidnightRefresh();
  }, next - new Date());
}
scheduleMidnightRefresh();

// Kick reminders if already granted
if (localStorage.getItem(STORAGE_NOTIF) === "on" && Notification.permission === "granted") {
  scheduleReminders();
}
