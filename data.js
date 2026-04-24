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

// --- MEAL PLAN per week+day ---
// Rotates weekly (sem 1–4). Each day has desayuno/comida/cena planned.
// These appear as subtitles on the "Hacer desayuno/comida/cena" tasks.
const MEALS = {
  1: {
    lunes:     { desayuno: "Huevo a la mexicana + papaya",            comida: "Picadillo con arroz + zanahoria rallada",   cena: "Quesadillas + pepino y apio" },
    martes:    { desayuno: "Hot cakes de avena y plátano + manzana",  comida: "Picadillo con arroz + zanahoria rallada",   cena: "Hamburguesas + ensalada de zanahoria" },
    miercoles: { desayuno: "Omelet con jamón + melón",                 comida: "Pasta con tocino y brócoli + pepino",       cena: "Sándwich + jícama" },
    jueves:    { desayuno: "Huevo a la mexicana + papaya",            comida: "Pasta con tocino y brócoli + pepino",       cena: "Quesadillas + pepino y apio" },
    viernes:   { desayuno: "Hot cakes de avena y plátano + manzana",  comida: "Pollo árabe + jícama",                       cena: "Hamburguesas + ensalada de zanahoria" },
    sabado:    { desayuno: "Omelet con jamón + melón",                 comida: "Pollo árabe + jícama",                       cena: "Sándwich + jícama" },
  },
  2: {
    lunes:     { desayuno: "Huevo con jamón + melón",                  comida: "Pasta a la boloñesa + pepino",               cena: "Pizza + ensalada de pepino" },
    martes:    { desayuno: "Chilaquiles rojos + piña",                 comida: "Pasta a la boloñesa + pepino",               cena: "Quesadillas + jícama" },
    miercoles: { desayuno: "Huevo con salchicha + papaya",             comida: "Filete de res con ensalada de brócoli + zanahoria", cena: "Hotdogs + apio y zanahoria" },
    jueves:    { desayuno: "Huevo con jamón + melón",                  comida: "Filete de res con ensalada de brócoli + zanahoria", cena: "Pizza + ensalada de pepino" },
    viernes:   { desayuno: "Chilaquiles rojos + piña",                 comida: "Caldo de pollo con arroz y verduras + apio", cena: "Quesadillas + jícama" },
    sabado:    { desayuno: "Huevo con salchicha + papaya",             comida: "Caldo de pollo con arroz y verduras + apio", cena: "Hotdogs + apio y zanahoria" },
  },
  3: {
    lunes:     { desayuno: "Huevo con salchicha americana + manzana",  comida: "Wok de bistec con arroz y verduras + jícama", cena: "Tortas + ensalada de zanahoria" },
    martes:    { desayuno: "Chilaquiles rojos de frijol + papaya",     comida: "Wok de bistec con arroz y verduras + jícama", cena: "Alitas + apio" },
    miercoles: { desayuno: "Hot cakes de avena + piña",                comida: "Pasta de salmón + pepino",                   cena: "Quesadillas + pepino" },
    jueves:    { desayuno: "Huevo con salchicha americana + manzana",  comida: "Pasta de salmón + pepino",                   cena: "Tortas + ensalada de zanahoria" },
    viernes:   { desayuno: "Chilaquiles rojos de frijol + papaya",     comida: "Carne en su jugo + apio",                    cena: "Alitas + apio" },
    sabado:    { desayuno: "Hot cakes de avena + piña",                comida: "Carne en su jugo + apio",                    cena: "Quesadillas + pepino" },
  },
  4: {
    lunes:     { desayuno: "Huevo con tocino + papaya",                comida: "Salmón con arroz + zanahoria rallada",       cena: "Hotdogs + pepino" },
    martes:    { desayuno: "Omelet con jamón + manzana",               comida: "Salmón con arroz + zanahoria rallada",       cena: "Sándwich + jícama" },
    miercoles: { desayuno: "Chilaquiles verdes + melón",               comida: "Filete de res con papas fritas + ensalada de col", cena: "Tamales + ensalada de col" },
    jueves:    { desayuno: "Huevo con tocino + papaya",                comida: "Filete de res con papas fritas + ensalada de col", cena: "Hotdogs + pepino" },
    viernes:   { desayuno: "Omelet con jamón + manzana",               comida: "Ensalada de atún + pepino",                  cena: "Sándwich + jícama" },
    sabado:    { desayuno: "Chilaquiles verdes + melón",               comida: "Ensalada de atún + pepino",                  cena: "Tamales + ensalada de col" },
  },
};

// --- LAUNDRY SCHEDULE ---
// New rule: 1 load per weekday (L–V), each day has a fixed type.
// Principal of the week does L/X/V; apoyo does M/J.
// Same person: lavar + tender + doblar + guardar (incluyendo ropa del otro).
const LAUNDRY_BY_DAY = {
  lunes:     { type: "Ropa negra",    steps: "Lavar + tender + doblar + guardar",         role: "principal" },
  martes:    { type: "Ropa blanca",   steps: "Lavar + tender + doblar + guardar",         role: "apoyo" },
  miercoles: { type: "Ropa de color", steps: "Lavar + tender + doblar + guardar",         role: "principal" },
  jueves:    { type: "Ropa de cama",  steps: "Lavar + tender + doblar + cambiar sábanas", role: "apoyo" },
  viernes:   { type: "Toallas",       steps: "Lavar + tender + doblar + guardar",         role: "principal" },
};

// Builds a weekday (lun–sáb) routine from the principal/apoyo assignment.
// Encodes regla de oro: si uno cocina, el otro lava.
function weekdayRoutine(P, A, meals) {
  return [
    { id: "desayuno",         t: "Hacer desayuno",           subtitle: meals?.desayuno, who: P, group: "comidas" },
    { id: "trastes-desayuno", t: "Lavar trastes desayuno",   who: A, group: "comidas" },
    { id: "comida",           t: "Hacer comida",             subtitle: meals?.comida,   who: P, group: "comidas" },
    { id: "trastes-comida",   t: "Lavar trastes comida",     who: A, group: "comidas" },
    { id: "cena",             t: "Hacer cena",               subtitle: meals?.cena,     who: A, group: "comidas" },
    { id: "trastes-cena",     t: "Lavar trastes cena",       who: P, group: "comidas" },
    { id: "barra",            t: "Limpiar barra y comedor",  who: A, group: "limpieza" },
  ];
}

function laundryFor(dayId, P, A) {
  const info = LAUNDRY_BY_DAY[dayId];
  if (!info) return null;
  const who = info.role === "principal" ? P : A;
  return {
    id: `${dayId}-lavanderia`,
    t: `Lavandería: ${info.type}`,
    subtitle: info.steps,
    who,
    group: "ropa",
  };
}

function makeWeek(P, A, weekNum, extras = {}) {
  const meals = MEALS[weekNum] || {};
  const weekday = (dayId) => {
    const base = weekdayRoutine(P, A, meals[dayId]).map(t => ({ ...t, id: `${dayId}-${t.id}` }));
    const laundry = laundryFor(dayId, P, A);
    if (laundry) base.push(laundry);
    return base;
  };

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
    sabado: (() => {
      // Saturday: meals + barra (weekday routine) but NO laundry.
      const base = weekdayRoutine(P, A, meals.sabado).map(t => ({ ...t, id: `sabado-${t.id}` }));
      return base.concat([
        { id: "sabado-bano-principal", t: "Limpiar baño 1 + baño común", who: P, group: "baños" },
        { id: "sabado-bano-apoyo",     t: "Limpiar su baño",             who: A, group: "baños" },
      ]);
    })(),
    // Sunday: outdoor only. Laundry moved to weekdays.
    domingo: [
      { id: "domingo-jardin",     t: "Limpiar jardín",    who: P, group: "exterior" },
      { id: "domingo-cochera",    t: "Limpiar cochera",   who: A, group: "exterior" },
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
  1: { principal: "ruben",   apoyo: "natalia", days: makeWeek("ruben",   "natalia", 1, WEEK_EXTRAS[1]) },
  2: { principal: "natalia", apoyo: "ruben",   days: makeWeek("natalia", "ruben",   2, WEEK_EXTRAS[2]) },
  3: { principal: "ruben",   apoyo: "natalia", days: makeWeek("ruben",   "natalia", 3, WEEK_EXTRAS[3]) },
  4: { principal: "natalia", apoyo: "ruben",   days: makeWeek("natalia", "ruben",   4, WEEK_EXTRAS[4]) },
};

// External services (informational, not checkable)
const EXTERNAL_SERVICES = [
  { t: "Peluquería de 2 perros", week: 3 },
  { t: "Jardinería",             week: 4 },
  { t: "Lavado profundo de coche", week: 4 },
];

// --- SHOPPING LIST per week ---
// Organized by category. Items are checkable and scoped to the ISO week so
// each real-world week gets a fresh list (even though the rotation repeats).
const SHOPPING = {
  1: {
    "Proteínas": ["Carne molida (500 g)", "Pechuga de pollo (500–700 g)", "Jamón (200–300 g)", "Tocino (200 g)"],
    "Granos y cereales": ["Arroz (1 kg)", "Pasta (500 g)", "Pan para sándwich", "Pan para hamburguesa", "Tortillas"],
    "Frutas": ["Papaya", "Manzana", "Melón", "Plátano"],
    "Verduras": ["Jitomate", "Cebolla", "Chile", "Zanahoria", "Pepino", "Jícama", "Brócoli", "Apio"],
    "Otros": ["Avena", "Leche", "Queso", "Aceite", "Especias / salsas"],
    "Comida para perros": ["4 pechugas de pollo", "1 bolsa de chips de verduras", "1 kg de arroz"],
  },
  2: {
    "Proteínas": ["Carne molida (500 g)", "Filete de res (500–700 g)", "Pollo (1 kg para caldo)", "Jamón (200 g)", "Salchichas"],
    "Granos y cereales": ["Pasta (500 g)", "Arroz (1 kg)", "Tortillas", "Pan para hotdog"],
    "Frutas": ["Melón", "Piña", "Papaya"],
    "Verduras": ["Jitomate", "Cebolla", "Brócoli", "Zanahoria", "Pepino", "Apio", "Chile"],
    "Otros": ["Salsa roja", "Queso", "Aceite", "Especias"],
    "Comida para perros": ["4 pechugas de pollo", "1 bolsa de chips de verduras", "1 kg de arroz"],
  },
  3: {
    "Proteínas": ["Bistec (500–700 g)", "Salmón (500 g)", "Carne para caldo/jugo (500 g)", "Salchicha americana", "Alitas de pollo"],
    "Granos y cereales": ["Arroz (1 kg)", "Pasta (500 g)", "Pan para tortas", "Tortillas"],
    "Frutas": ["Manzana", "Papaya", "Piña"],
    "Verduras": ["Jícama", "Pepino", "Zanahoria", "Apio", "Jitomate", "Cebolla"],
    "Otros": ["Frijoles", "Salsa", "Queso", "Aceite", "Especias"],
    "Comida para perros": ["4 pechugas de pollo", "1 bolsa de chips de verduras", "1 kg de arroz"],
  },
  4: {
    "Proteínas": ["Salmón (500–700 g)", "Filete de res (500–700 g)", "Atún (latas)", "Jamón (200 g)", "Tocino (200 g)"],
    "Granos y cereales": ["Arroz (1 kg)", "Pan para sándwich", "Pan para hotdog", "Tortillas"],
    "Frutas": ["Papaya", "Manzana", "Melón"],
    "Verduras": ["Zanahoria", "Pepino", "Jícama", "Col", "Jitomate", "Cebolla"],
    "Otros": ["Tamales", "Salsa verde", "Queso", "Aceite", "Especias"],
    "Comida para perros": ["4 pechugas de pollo", "1 bolsa de chips de verduras", "1 kg de arroz"],
  },
};

// Stable slug for shopping check keys
function shopSlug(s) {
  return String(s).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

// Group options the user can pick when creating a custom task
const GROUPS = [
  { key: "comidas",  label: "Comidas",  icon: "🍽️" },
  { key: "perros",   label: "Perros",   icon: "🐕" },
  { key: "limpieza", label: "Limpieza", icon: "🧹" },
  { key: "baños",    label: "Baños",    icon: "🚿" },
  { key: "ropa",     label: "Ropa",     icon: "👕" },
  { key: "exterior", label: "Exterior", icon: "🌳" },
  { key: "mensual",  label: "Mensual",  icon: "📅" },
  { key: "otros",    label: "Otros",    icon: "✨" },
];

const DAY_SHORT = {
  lunes: "L", martes: "M", miercoles: "X",
  jueves: "J", viernes: "V", sabado: "S", domingo: "D",
};

// Does a custom task apply on the given day / week / date?
function customTaskApplies(task, { dayKey, weekNum, dateStr }) {
  if (!task) return false;
  if (task.recurrence === "daily") return true;
  if (task.recurrence === "once") return task.date === dateStr;
  if (task.recurrence === "weekly") {
    const dayOK  = Array.isArray(task.days)  && task.days.includes(dayKey);
    const weekOK = Array.isArray(task.weeks) && task.weeks.includes(weekNum);
    return dayOK && weekOK;
  }
  return false;
}

// Return the subset of custom tasks that apply for a given day context.
// Each returned task is stamped with the `customTask: true` flag so the UI
// can show delete affordances.
function getCustomTasksFor({ dayKey, weekNum, dateStr }, all) {
  if (!Array.isArray(all)) return [];
  return all
    .filter(t => customTaskApplies(t, { dayKey, weekNum, dateStr }))
    .map(t => ({ ...t, customTask: true }));
}
