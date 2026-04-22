// Chores data extracted from the plan image
// Two users: ruben, natalia
// 4-week rotation. Week 1 & 3: Rubén principal. Week 2 & 4: Natalia principal.

const USERS = {
  ruben:   { name: "Rubén",   password: "990899", color: "#2563eb" },
  natalia: { name: "Natalia", password: "abril13", color: "#ec4899" },
};

const DAY_NAMES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MONTH_NAMES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

// Daily routine — every day, both users
const DAILY_TASKS = [
  { id: "desayuno",   text: "Desayuno",                             who: "rotates" },
  { id: "comida",     text: "Comida",                               who: "rotates" },
  { id: "cena",       text: "Cena",                                 who: "rotates" },
  { id: "trastes",    text: "Lavar trastes de cada comida",         who: "rotates" },
  { id: "perros-comida", text: "Dar de comer a los perros (2 veces)", who: "both" },
  { id: "perros-med",    text: "Medicina al perro (2 veces)",         who: "both" },
  { id: "perros-limp",   text: "Limpiar pipís y popós de los perros", who: "both" },
  { id: "barra",      text: "Limpiar barra de cocina y comedor",    who: "both" },
];

// Helpers for building the weekly plan.
// principal = quien es responsable principal esa semana
// apoyo     = la otra persona
// Pattern pulled directly from the image for each day.
function makeWeek(principal, apoyo, extras) {
  const P = principal, A = apoyo;
  const base = {
    lunes: [
      { t: "Desayuno", who: P },
      { t: "Trastes + Limpieza + Perros", who: A },
      { t: "Comida", who: P },
      { t: "Cena", who: A },
    ],
    martes: [
      { t: "Desayuno", who: P },
      { t: "Trastes + Limpieza + Perros", who: A },
      { t: "Comida", who: P },
      { t: "Cena", who: A },
      { t: "Barrer + Trapear pisos", who: A, icon: "broom" },
    ],
    miercoles: [
      { t: "Desayuno", who: P },
      { t: "Trastes + Limpieza + Perros", who: A },
      { t: "Comida", who: P },
      { t: "Cena", who: A },
    ],
    jueves: [
      { t: "Desayuno", who: P },
      { t: "Trastes + Limpieza + Perros", who: A },
      { t: "Comida", who: P },
      { t: "Cena", who: A },
      { t: "Limpiar estantes de cocina", who: A, icon: "kitchen" },
      { t: "Limpiar microondas", who: A, icon: "kitchen" },
    ],
    viernes: [
      { t: "Desayuno", who: P },
      { t: "Trastes + Limpieza + Perros", who: A },
      { t: "Comida", who: P },
      { t: "Cena", who: A },
      { t: P === "ruben" ? "Rubén trabaja 3pm–9pm" : "Natalia trabaja 3pm–9pm", who: "note", icon: "work" },
    ],
    sabado: [
      { t: "Desayuno", who: P },
      { t: "Trastes + Limpieza + Perros", who: A },
      { t: "Comida", who: P },
      { t: "Cena", who: A },
      { t: "Baño 1 + Baño común", who: P, icon: "bath" },
      { t: "Limpiar su baño", who: A, icon: "bath" },
    ],
    domingo: [
      { t: "Lavado + Sábanas + Exterior", who: "both", icon: "laundry", header: true },
      { t: "Separar ropa por color", who: "both" },
      { t: "Lavar y tender ropa", who: P },
      { t: "Doblar ropa", who: A },
      { t: "Guardar ropa (cada quien la suya)", who: "both" },
      { t: "Quitar y lavar sábanas", who: P, icon: "bed" },
      { t: "Poner sábanas limpias", who: A, icon: "bed" },
      { t: "Limpiar jardín", who: P, icon: "garden" },
      { t: "Limpiar cochera", who: A, icon: "car" },
    ],
  };
  // Merge extras into specific days
  if (extras) {
    for (const day in extras) {
      base[day] = base[day].concat(extras[day]);
    }
  }
  return base;
}

// Week-specific extras from the image
const WEEK_EXTRAS = {
  1: {}, // baseline
  2: {}, // baseline (car wash is mentioned as "SEMANA 2" external service, handled in monthly view)
  3: {
    miercoles: [{ t: "Limpiar ventanales", who: "ruben", icon: "window", monthly: true }],
    sabado:    [{ t: "Aspirar sillones", who: "natalia", icon: "couch", monthly: true }],
    // peluquería de 2 perros — servicio externo (mes)
  },
  4: {
    miercoles: [{ t: "Limpiar mosquiteros", who: "ruben", icon: "window", monthly: true }],
    domingo: [
      { t: "Limpiar closets", who: "natalia", icon: "closet", monthly: true },
      { t: "Limpiar apagadores", who: "natalia", icon: "switch", monthly: true },
      { t: "Limpiar refri y alacena", who: "both", icon: "kitchen", monthly: true },
      { t: "Lavar lavadora", who: "both", icon: "laundry", monthly: true },
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

const DAY_KEYS = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"];

// Determine current week (1–4) based on the week of the month.
// We use ISO week boundaries so it rolls over cleanly.
function getCurrentWeekNumber(date = new Date()) {
  // Week number within the month: 1 + floor((dayOfMonth - 1 + firstWeekday) / 7), mod 4
  const day = date.getDate();
  const first = new Date(date.getFullYear(), date.getMonth(), 1).getDay(); // 0=Sun
  const weekOfMonth = Math.floor((day - 1 + first) / 7) + 1;
  return ((weekOfMonth - 1) % 4) + 1;
}

function getTodayKey(date = new Date()) {
  return DAY_KEYS[date.getDay()];
}

function formatDateEs(date = new Date()) {
  return `${date.getDate()} de ${MONTH_NAMES[date.getMonth()]}`;
}
