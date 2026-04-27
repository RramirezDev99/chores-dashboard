// Chores data — current logic.
//
// Model:
//   - Cocina: roles fijos (Natalia desayuno, Rubén cena; comida varía por día).
//   - Operativo diario: una persona por semana se encarga de perros, trastes
//     y limpieza diaria. Sem 1 y 3: Rubén. Sem 2 y 4: Natalia.
//   - Lavandería: días fijos L–J con asignación fija (no rota por semana).
//   - Tareas semanales: se distribuyen por día, algunas alternan por semana,
//     otras son siempre de la misma persona.
//   - Tareas mensuales: 2 por semana, asignadas a Sábado.

const USERS = {
  ruben:   { name: "Rubén",   color: "#2563eb" },
  natalia: { name: "Natalia", color: "#ec4899" },
};

const DAY_NAMES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MONTH_NAMES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const DAY_KEYS = ["domingo","lunes","martes","miercoles","jueves","viernes","sabado"];

// Empty in the new model — perros now live in per-day tasks tied to "operativo".
// The constant is kept for backward compatibility with code that references it.
const DAILY_TASKS = [];

// Who is "operativo diario" for a given rotation week.
// Sem 1 y 3 → Rubén · Sem 2 y 4 → Natalia.
function operativoFor(weekNum) {
  return (weekNum === 1 || weekNum === 3) ? "ruben" : "natalia";
}
function otherUser(u) { return u === "ruben" ? "natalia" : "ruben"; }

// Cooking assignments — fixed across the month (no P/A rotation).
//   Desayuno: Natalia siempre.
//   Cena:     Rubén siempre.
//   Comida:   L y X → Natalia; V → Rubén; M, J, S no tienen "Hacer comida"
//             prescrito (se usa lo cocinado en batch / improvisado).
function cookingFor(meal, dayKey) {
  if (meal === "desayuno") return "natalia";
  if (meal === "cena")     return "ruben";
  if (meal === "comida") {
    if (dayKey === "lunes" || dayKey === "miercoles") return "natalia";
    if (dayKey === "viernes") return "ruben";
    return null;
  }
  return null;
}

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

// --- LAUNDRY ---
// Lunes-Jueves, día y persona fijos (no rota). Quien lava también tiende y
// dobla; cada quien guarda LA SUYA por la noche (tasks separadas).
const LAUNDRY_BY_DAY = {
  lunes:     { type: "Ropa negra",   who: "ruben"   },
  martes:    { type: "Ropa blanca",  who: "natalia" },
  miercoles: { type: "Toallas",      who: "ruben"   },
  jueves:    { type: "Ropa de color",who: "natalia" },
};

// --- TAREAS SEMANALES POR DÍA ---
// Algunas alternan por semana (L basura/barrer, X baño común, S batch/perras),
// otras son fijas siempre (M estantes, J barrer, V basura+estantes).
function weeklyTasksForDay(dayKey, weekNum) {
  const oddPattern = (weekNum === 1 || weekNum === 3); // sem 1/3 = Rubén operativo
  const tasks = [];

  switch (dayKey) {
    case "lunes":
      tasks.push({ id: "basura",        t: "Sacar la basura",        who: oddPattern ? "ruben"   : "natalia", group: "limpieza" });
      tasks.push({ id: "barrer",        t: "Barrer + trapear",        who: oddPattern ? "natalia" : "ruben",   group: "limpieza" });
      break;
    case "martes":
      tasks.push({ id: "estantes-microondas", t: "Limpiar estantes + microondas", who: "ruben", group: "limpieza" });
      break;
    case "miercoles":
      tasks.push({ id: "bano-natalia",  t: "Limpiar baño de Natalia", who: "natalia", group: "baños" });
      tasks.push({ id: "bano-ruben",    t: "Limpiar baño de Rubén",   who: "ruben",   group: "baños" });
      tasks.push({ id: "bano-comun",    t: "Limpiar baño común",      who: oddPattern ? "natalia" : "ruben", group: "baños" });
      break;
    case "jueves":
      tasks.push({ id: "barrer-trapear", t: "Barrer + trapear",       who: "ruben",   group: "limpieza" });
      break;
    case "viernes":
      tasks.push({ id: "basura-estantes", t: "Sacar basura + estantes",who: "natalia", group: "limpieza" });
      break;
    case "sabado":
      tasks.push({ id: "super-compras",   t: "Súper + compras",        who: "both",                          group: "comidas" });
      tasks.push({ id: "batch-cooking",   t: "Batch cooking",           who: oddPattern ? "natalia" : "ruben", group: "comidas" });
      tasks.push({ id: "comida-perras",   t: "Preparar comida de las perras", who: oddPattern ? "ruben" : "natalia", group: "perros" });
      tasks.push({ id: "jardin",          t: "Limpiar jardín",          who: oddPattern ? "ruben" : "natalia", group: "exterior" });
      tasks.push({ id: "cochera",         t: "Limpiar cochera",         who: oddPattern ? "ruben" : "natalia", group: "exterior" });
      tasks.push({ id: "sabanas",         t: "Cambiar sábanas",         who: "both",                          group: "ropa" });
      break;
    case "domingo":
      // Día de descanso completo — solo se mantiene la rutina diaria del operativo.
      break;
  }
  return tasks;
}

// --- TAREAS MENSUALES POR SEMANA ---
// Una tarea para cada usuario por semana, ancladas a Sábado.
const MONTHLY_BY_WEEK = {
  1: [
    { id: "ventanales", t: "Limpiar ventanales", who: "natalia", group: "mensual", monthly: true },
    { id: "sillones",   t: "Aspirar sillones",   who: "ruben",   group: "mensual", monthly: true },
  ],
  2: [
    { id: "mosquiteros", t: "Limpiar mosquiteros", who: "natalia", group: "mensual", monthly: true },
    { id: "closets",     t: "Limpiar closets",     who: "ruben",   group: "mensual", monthly: true },
  ],
  3: [
    { id: "refri-alacena", t: "Limpiar refri + alacena", who: "natalia", group: "mensual", monthly: true },
    { id: "apagadores",    t: "Limpiar apagadores",      who: "ruben",   group: "mensual", monthly: true },
  ],
  4: [
    { id: "lavadora-bote", t: "Lavar lavadora + bote de basura", who: "natalia", group: "mensual", monthly: true },
    { id: "carro",         t: "Lavar el carro",                  who: "ruben",   group: "mensual", monthly: true },
  ],
};

// Builds the full task list for a given (week, day).
// Encapsulates: cocina, trastes, perros, barra, lavandería, tareas semanales,
// tareas mensuales (en Sábado de su semana).
function tasksForDay(weekNum, dayKey) {
  const meals = (MEALS[weekNum] || {})[dayKey] || {};
  const operativo = operativoFor(weekNum);
  const tasks = [];

  // --- Cocina + trastes ---
  // No cooking on Sunday; meal plan only spans L–S.
  if (dayKey !== "domingo") {
    const desWho = cookingFor("desayuno", dayKey);
    const comWho = cookingFor("comida",   dayKey);
    const cenWho = cookingFor("cena",     dayKey);

    if (desWho) tasks.push({ id: `${dayKey}-desayuno`, t: "Hacer desayuno", subtitle: meals.desayuno, who: desWho, group: "comidas" });
    if (comWho) tasks.push({ id: `${dayKey}-comida`,   t: "Hacer comida",   subtitle: meals.comida,   who: comWho, group: "comidas" });
    if (cenWho) tasks.push({ id: `${dayKey}-cena`,     t: "Hacer cena",     subtitle: meals.cena,     who: cenWho, group: "comidas" });

    // Trastes: operativo se encarga de los tres
    tasks.push({ id: `${dayKey}-trastes-desayuno`, t: "Lavar trastes desayuno", who: operativo, group: "comidas" });
    if (comWho || dayKey === "sabado") {
      tasks.push({ id: `${dayKey}-trastes-comida`, t: "Lavar trastes comida", who: operativo, group: "comidas" });
    }
    tasks.push({ id: `${dayKey}-trastes-cena`,     t: "Lavar trastes cena",     who: operativo, group: "comidas" });

    // Limpieza diaria (barra y comedor)
    tasks.push({ id: `${dayKey}-barra`, t: "Limpiar barra y comedor", who: operativo, group: "limpieza" });
  }

  // --- Perros (todos los días, operativo) ---
  tasks.push({ id: `${dayKey}-perros-comida-am`, t: "Comida perros — mañana",     who: operativo, group: "perros" });
  tasks.push({ id: `${dayKey}-perros-comida-pm`, t: "Comida perros — noche",       who: operativo, group: "perros" });
  tasks.push({ id: `${dayKey}-perros-med-am`,    t: "Medicina perros — mañana",    who: operativo, group: "perros" });
  tasks.push({ id: `${dayKey}-perros-med-pm`,    t: "Medicina perros — noche",     who: operativo, group: "perros" });
  tasks.push({ id: `${dayKey}-perros-limpieza`,  t: "Limpiar pipís y popós",       who: operativo, group: "perros" });

  // --- Lavandería del día (L–J) ---
  const laundry = LAUNDRY_BY_DAY[dayKey];
  if (laundry) {
    tasks.push({
      id: `${dayKey}-lavanderia`,
      t: `Lavandería: ${laundry.type}`,
      subtitle: "Lavar + tender + doblar",
      who: laundry.who,
      group: "ropa",
    });
    // Cada quien guarda la suya por la noche
    tasks.push({ id: `${dayKey}-guardar-ruben`,   t: "Guardar tu ropa", who: "ruben",   group: "ropa" });
    tasks.push({ id: `${dayKey}-guardar-natalia`, t: "Guardar tu ropa", who: "natalia", group: "ropa" });
  }

  // --- Friday work-schedule note (recordatorio, no checkable) ---
  if (dayKey === "viernes") {
    const worker = operativo === "ruben" ? "ruben" : "natalia";
    tasks.push({
      id: `viernes-nota-${worker}`,
      t: `${USERS[worker].name} trabaja 3pm–9pm`,
      who: "note",
    });
  }

  // --- Tareas semanales del día ---
  for (const wt of weeklyTasksForDay(dayKey, weekNum)) {
    tasks.push({ ...wt, id: `${dayKey}-${wt.id}` });
  }

  // --- Tareas mensuales (Sábado de cada semana) ---
  if (dayKey === "sabado") {
    for (const mt of (MONTHLY_BY_WEEK[weekNum] || [])) {
      tasks.push({ ...mt, id: `mensual-w${weekNum}-${mt.id}` });
    }
  }

  return tasks;
}

function buildWeekPlan(weekNum) {
  const op = operativoFor(weekNum);
  const days = {};
  for (const dk of DAY_KEYS) days[dk] = tasksForDay(weekNum, dk);
  return {
    operativo: op,
    apoyo:     otherUser(op),
    // Backwards-compat aliases — older render code reads these
    principal: op,
    days,
  };
}

const WEEK_PLAN = {
  1: buildWeekPlan(1),
  2: buildWeekPlan(2),
  3: buildWeekPlan(3),
  4: buildWeekPlan(4),
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
