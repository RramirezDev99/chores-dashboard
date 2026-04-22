// Chores data — restructured for accurate business logic.
//
// Structure:
//   DAILY_TASKS: run every day, not tied to week rotation. Shared checkboxes
//     for dog duties; "either can check."
//   WEEK_PLAN[w].days[dayKey]: day-specific tasks, one entry per checkable
//     item. who can be "ruben" | "natalia" | "both" | "note".
//
// Regla de oro is encoded: for breakfast/lunch the principal cooks and apoyo
// washes; for dinner apoyo cooks and principal washes.

const USERS = {
  ruben:   { name: "Rubén",   color: "#2563eb" },
  natalia: { name: "Natalia", color: "#ec4899" },
};

const DAY_NAMES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MONTH_NAMES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const DAY_KEYS = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"];

// Runs every day, both users share them (anyone can check)
const DAILY_TASKS = [
  { id: "perros-comida-am", t: "Comida perros — mañana",  who: "both", group: "perros" },
  { id: "perros-comida-pm", t: "Comida perros — noche",   who: "both", group: "perros" },
  { id: "perros-med-am",    t: "Medicina del perro — mañana", who: "both", group: "perros" },
  { id: "perros-med-pm",    t: "Medicina del perro — noche",  who: "both", group: "perros" },
  { id: "perros-limpieza",  t: "Limpiar pipís y popós",    who: "both", group: "perros" },
];

// Builds a weekday (lun–sáb) routine from the principal/apoyo assignment.
// Encodes regla de oro: si uno cocina, el otro lava.
function weekdayRoutine(P, A) {
  return [
    { id: "desayuno",         t: "Hacer desayuno",           who: P, group: "comidas" },
    { id: "trastes-desayuno", t: "Lavar trastes desayuno",   who: A, group: "comidas" },
    { id: "comida",           t: "Hacer comida",             who: P, group: "comidas" },
    { id: "trastes-comida",   t: "Lavar trastes comida",     who: A, group: "comidas" },
    { id: "cena",             t: "Hacer cena",               who: A, group: "comidas" },
    { id: "trastes-cena",     t: "Lavar trastes cena",       who: P, group: "comidas" },
    { id: "barra",            t: "Limpiar barra y comedor",  who: A, group: "limpieza" },
  ];
}

function makeWeek(P, A, extras = {}) {
  const weekday = (dayId) => weekdayRoutine(P, A).map(t => ({ ...t, id: `${dayId}-${t.id}` }));

  const plan = {
    lunes:     weekday("lunes"),
    martes:    weekday("martes").concat([
      { id: "martes-barrer",  t: "Barrer pisos",  who: A, group: "limpieza" },
      { id: "martes-trapear", t: "Trapear pisos", who: A, group: "limpieza" },
    ]),
    miercoles: weekday("miercoles"),
    jueves:    weekday("jueves").concat([
      { id: "jueves-estantes",   t: "Limpiar estantes de cocina", who: A, group: "limpieza" },
      { id: "jueves-microondas", t: "Limpiar microondas",         who: A, group: "limpieza" },
    ]),
    viernes:   weekday("viernes").concat([
      { id: `viernes-nota-${P}`, t: `${USERS[P].name} trabaja 3pm–9pm`, who: "note" },
    ]),
    sabado:    weekday("sabado").concat([
      { id: "sabado-bano-principal", t: "Limpiar baño 1 + baño común", who: P, group: "baños" },
      { id: "sabado-bano-apoyo",     t: "Limpiar su baño",             who: A, group: "baños" },
    ]),
    // Sunday is laundry + outdoor, no cooking rotation in the plan
    domingo: [
      { id: "domingo-header",     t: "Lavado + Sábanas + Exterior", who: "header" },
      { id: "domingo-separar",    t: "Separar ropa por color",      who: "both", group: "ropa" },
      { id: "domingo-lavar",      t: "Lavar y tender ropa",         who: P,      group: "ropa" },
      { id: "domingo-doblar",     t: "Doblar ropa",                 who: A,      group: "ropa" },
      { id: "domingo-guardar-r",  t: "Guardar su ropa",             who: "ruben",   group: "ropa" },
      { id: "domingo-guardar-n",  t: "Guardar su ropa",             who: "natalia", group: "ropa" },
      { id: "domingo-sabanas-q",  t: "Quitar y lavar sábanas",      who: P,      group: "ropa" },
      { id: "domingo-sabanas-p",  t: "Poner sábanas limpias",       who: A,      group: "ropa" },
      { id: "domingo-jardin",     t: "Limpiar jardín",              who: P,      group: "exterior" },
      { id: "domingo-cochera",    t: "Limpiar cochera",             who: A,      group: "exterior" },
    ],
  };

  // Merge week-specific extras (monthly tasks that land on specific weeks)
  for (const day in extras) {
    plan[day] = plan[day].concat(extras[day]);
  }
  return plan;
}

// Monthly tasks, mapped to the week they should happen per the plan image
const WEEK_EXTRAS = {
  1: {},
  2: {
    // "Lavado de carro básico (ustedes) - Semana 2" — put on Sunday
    domingo: [
      { id: "mes-lavar-carro-basico", t: "Lavar carro (básico)", who: "both", group: "mensual", monthly: true },
    ],
  },
  3: {
    miercoles: [{ id: "mes-ventanales", t: "Limpiar ventanales", who: "ruben", group: "mensual", monthly: true }],
    sabado:    [{ id: "mes-sillones",   t: "Aspirar sillones",   who: "natalia", group: "mensual", monthly: true }],
    // Peluquería de 2 perros (servicio externo) — no checkbox, shown in Month view
  },
  4: {
    miercoles: [{ id: "mes-mosquiteros", t: "Limpiar mosquiteros", who: "ruben", group: "mensual", monthly: true }],
    domingo: [
      { id: "mes-closets",     t: "Limpiar closets",         who: "natalia", group: "mensual", monthly: true },
      { id: "mes-apagadores",  t: "Limpiar apagadores",      who: "natalia", group: "mensual", monthly: true },
      { id: "mes-refri",       t: "Limpiar refri y alacena", who: "both",    group: "mensual", monthly: true },
      { id: "mes-lavadora",    t: "Lavar lavadora",          who: "both",    group: "mensual", monthly: true },
    ],
    // Jardinería y lavado profundo de coche — servicios externos
  },
};

const WEEK_PLAN = {
  1: { principal: "ruben",   apoyo: "natalia", days: makeWeek("ruben",   "natalia", WEEK_EXTRAS[1]) },
  2: { principal: "natalia", apoyo: "ruben",   days: makeWeek("natalia", "ruben",   WEEK_EXTRAS[2]) },
  3: { principal: "ruben",   apoyo: "natalia", days: makeWeek("ruben",   "natalia", WEEK_EXTRAS[3]) },
  4: { principal: "natalia", apoyo: "ruben",   days: makeWeek("natalia", "ruben",   WEEK_EXTRAS[4]) },
};

// External services (informational, not checkable)
const EXTERNAL_SERVICES = [
  { t: "Peluquería de 2 perros", week: 3 },
  { t: "Jardinería",             week: 4 },
  { t: "Lavado profundo de coche", week: 4 },
];

function getAutoWeekNumber(date = new Date()) {
  const day = date.getDate();
  const first = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const weekOfMonth = Math.floor((day - 1 + first) / 7) + 1;
  return ((weekOfMonth - 1) % 4) + 1;
}

function getTodayKey(date = new Date()) {
  return DAY_KEYS[date.getDay()];
}

function formatDateEs(date = new Date()) {
  return `${date.getDate()} de ${MONTH_NAMES[date.getMonth()]}`;
}

function dateKey(date = new Date()) {
  // Local date in YYYY-MM-DD (so "today" aligns with the user's clock, not UTC)
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ISO week string for Sunday review storage, e.g. "2026-W17"
function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
