"use strict";

/* Расчёты на странице: все формулы собраны здесь.
   Значения по умолчанию - допущения, которые уточняются по итогам запуска. */

const $ = (id) => document.getElementById(id);

const num = (id) => {
  const el = $(id);
  if (!el) return 0;
  const v = parseFloat(String(el.value).replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};

const rub = (n) => Math.round(n).toLocaleString("ru-RU") + "\u00a0₽";
const fmt = (n, d = 0) =>
  n.toLocaleString("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d });

const plural = (n, one, few, many) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

const SIGNED = (n) => {
  const cls = n >= 0 ? "pos" : "neg";
  const sign = n >= 0 ? "+" : "−";
  return `<span class="${cls}">${sign}${rub(Math.abs(n))}</span>`;
};

/* Параметры расчёта из полей калькулятора */
function params() {
  return {
    volume: num("c-volume"),          // объём команды, м2 в месяц
    area: num("c-area") || 1,         // средняя площадь позиции, м2
    rateC: num("c-rate-c"),           // ставка исполнителю, руб/м2
    rateK: num("c-rate-k"),           // ставка проверяющему, руб/м2
    taxUsn: num("c-tax-usn") / 100,   // налог ИП (УСН), доля
    taxNpd: num("c-tax-npd") / 100,   // налог самозанятого, доля
    prod: num("c-prod") || 1,         // м2 в рабочий день у исполнителя
    workDays: num("c-days") || 21,    // рабочих дней в месяц
    load: (num("c-load") || 95) / 100, // целевая загрузка исполнителя, доля
    models: num("c-models"),          // число позиций в программе
    team: num("c-team") || 1,         // исполнителей в группе сейчас
    deadline: num("c-deadline") || 1, // рабочих дней до срока заказчика
  };
}

/* Число исполнителей: объём / (выработка за период × целевая загрузка), вверх; минимум 1 */
const peopleFor = (p, volume, days) =>
  Math.max(1, Math.ceil(volume / (p.prod * days * p.load) - 1e-9));

/* Загрузка исполнителя в долях от его возможной выработки за период */
const loadShare = (p, m2PerPerson, days) => m2PerPerson / (p.prod * days);

/* Доля мощности группы, которую можно гарантировать в договоре */
const GUARANTEE = 0.85;

/* Ставка по договору, руб/м2 */
const contractRate = (p, withNpd) => {
  const base = withNpd ? p.rateC / (1 - p.taxNpd) : p.rateC;
  return (base + p.rateK) / (1 - p.taxUsn);
};

function renderCalc() {
  const p = params();
  const n = peopleFor(p, p.volume, p.workDays);          // сколько исполнителей нужно на объём
  const per = p.volume / n;                              // м2 на одного из нужных исполнителей
  const items = p.volume / p.area;
  const rate1 = contractRate(p, false);
  const rate2 = contractRate(p, true);
  const monthlyCost = p.volume * rate2;
  const share = loadShare(p, per, p.workDays);
  const cap = p.team * p.prod * p.workDays;              // мощность группы в месяц
  const capDeadline = p.team * p.prod * p.deadline;      // мощность группы до срока заказчика
  const guarantee = cap * GUARANTEE;
  const guaranteeDeadline = capDeadline * GUARANTEE;

  const warnings = [];
  if (n > p.team) {
    warnings.push(
      `<div class="callout bad"><strong>Людей не хватает.</strong> На объём ${fmt(p.volume, 0)} м² нужно ${n} ${plural(n, "исполнитель", "исполнителя", "исполнителей")}, в группе ${p.team}. Либо берём меньше объёма, либо добираем людей, либо растёт выработка.</div>`
    );
  } else if (p.volume > guarantee) {
    warnings.push(
      `<div class="callout warn"><strong>Объём выше 85% мощности группы</strong> (${fmt(guarantee, 0)} м²). Гарантировать в договоре столько нельзя: нет запаса на правки и ожидание данных.</div>`
    );
  } else {
    warnings.push(
      `<div class="callout ok"><strong>Объём в пределах мощности группы.</strong> Для него нужно ${n} ${plural(n, "исполнитель", "исполнителя", "исполнителей")} из ${p.team}${n < p.team ? ", остальные в резерве или берут больше" : ""}.</div>`
    );
  }
  if (per * p.rateC < 50000 && n <= p.team) {
    warnings.push(
      `<div class="callout warn">Доход одного исполнителя при таком объёме ${rub(per * p.rateC)} в месяц: меньше ориентира 50 000 ₽. Нужен больший объём или меньше людей.</div>`
    );
  }

  const kpi = (k, v, s) =>
    `<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  const row = (k, v) => `<div class="rrow"><span>${k}</span><b>${v}</b></div>`;

  $("calc-out").innerHTML = `
    <div class="kpis">
      ${kpi("Исполнителей нужно", n, "из " + p.team + " в группе")}
      ${kpi("Доход исполнителя", rub(per * p.rateC), "в месяц")}
      ${kpi("Загрузка", fmt(share * 100, 0) + "%", fmt(per, 0) + " м² в месяц на человека")}
      ${kpi("Гарантия в договоре", fmt(guarantee, 0) + " м²", "85% мощности в месяц")}
    </div>
    ${warnings.join("")}
    <div class="rgroup"><h4>Объём</h4>
      ${row("Позиций в месяц", fmt(items, 0))}
      ${row("Позиций в рабочий день", fmt(items / p.workDays, 1))}
      ${row("На исполнителя в неделю, м²", fmt(per / (p.workDays / 5), 0))}
    </div>
    <div class="rgroup"><h4>Мощность группы</h4>
      ${row("В месяц, м²", fmt(cap, 0))}
      ${row("До срока заказчика, м²", fmt(capDeadline, 0))}
      ${row("Гарантия к сроку (85%), м² / позиций", fmt(guaranteeDeadline, 0) + " / " + fmt(guaranteeDeadline / p.area, 0))}
    </div>
    <div class="rgroup"><h4>Деньги</h4>
      ${row("Фонд оплаты исполнителям", rub(p.volume * p.rateC))}
      ${row("Проверка и координация", rub(p.volume * p.rateK))}
      ${row("Ставка по договору, ₽/м² (УСН)", fmt(rate1, 0))}
      ${row("То же + налог самозанятых, ₽/м²", fmt(rate2, 0))}
      ${row("Расходы заказчика в месяц (вторая ставка)", rub(monthlyCost))}
    </div>
  `;
}

/* План на месяц: группа из ИГ исполнителей, по неделям, накопительно */
function renderPlan() {
  const p = params();
  const days = Math.max(1, Math.round(p.workDays));
  const rows = [];
  let done = 0;
  let cum = 0;
  let week = 1;
  while (done < days) {
    const d = Math.min(5, days - done);
    const from = done + 1;
    done += d;
    const team = p.team * p.prod * d;
    cum += team;
    const perPerson = cum / p.team;
    rows.push(`<tr>
      <td>Неделя ${week}</td>
      <td class="num">${from === done ? "день " + from : "дни " + from + "–" + done}</td>
      <td class="num">${fmt(team, 0)}</td>
      <td class="num">${fmt(cum, 0)}</td>
      <td class="num">${fmt(cum / p.area, 0)}</td>
      <td class="num">${fmt(perPerson, 0)}</td>
      <td class="num">${rub(perPerson * p.rateC)}</td>
    </tr>`);
    week++;
  }
  const guarantee = cum * GUARANTEE;
  rows.push(`<tr class="row-target">
      <td colspan="3"><strong>Гарантия в договоре (85% мощности)</strong></td>
      <td class="num"><strong>${fmt(guarantee, 0)}</strong></td>
      <td class="num"><strong>${fmt(guarantee / p.area, 0)}</strong></td>
      <td class="num"><strong>${fmt(guarantee / p.team, 0)}</strong></td>
      <td class="num"><strong>${rub((guarantee / p.team) * p.rateC)}</strong></td>
    </tr>`);
  $("plan-body").innerHTML = rows.join("");
  $("plan-team").textContent = fmt(p.team, 0);
  $("plan-prod").textContent = fmt(p.prod, 1);
  $("plan-days").textContent = fmt(days, 0);
  $("plan-deadline").textContent = fmt(p.deadline, 0);
  $("plan-deadline-m2").textContent = fmt(p.team * p.prod * p.deadline, 0);
}

/* Сценарии выработки на месяц (6-10 м2 в день) */
const SCENARIOS = [
  { prod: 6, tag: "min", label: "средний показатель, 5 дней в неделю" },
  { prod: 6, k: 1.2, label: "то же плюс работа в субботу (6 дней в неделю)" },
  { prod: 10, tag: "target", label: "уровень штатного сотрудника" },
];

const TAG_HTML = {
  min: '<span class="badge min">базовая</span>',
  target: '<span class="badge target">потенциал</span>',
};

function renderScenarios() {
  const p = params();
  const days = Math.max(1, Math.round(p.workDays));
  const rows = SCENARIOS.map((s) => {
    const k = s.k || 1; // коэффициент выходных: 1,2 = шесть дней в неделю вместо пяти
    const month = p.team * s.prod * days * k;
    const tag = s.tag ? " " + TAG_HTML[s.tag] : "";
    const cls = s.tag ? ` class="row-${s.tag}"` : "";
    return `<tr${cls}>
      <td>${fmt(s.prod, 0)} м² в день${tag}<br><span class="small">${s.label}</span></td>
      <td class="num">${fmt(s.prod * 5 * k, 0)}</td>
      <td class="num">${fmt(month, 0)}</td>
      <td class="num">${fmt(month * GUARANTEE, 0)}</td>
      <td class="num">${fmt(month / p.area, 0)}</td>
      <td class="num">${rub(s.prod * days * k * p.rateC)}</td>
    </tr>`;
  });
  $("scen-body").innerHTML = rows.join("");
}

/* Сроки позиций по площади: срок = площадь / выработка, вверх, минимум 1 день */
function renderDueTable() {
  const el = $("due-body");
  if (!el) return;
  const p = params();
  const a = p.prod;
  const rows = [
    [`до ${fmt(a, 0)} м²`, "1 рабочий день"],
    [`${fmt(a, 0)}–${fmt(2 * a, 0)} м²`, "2 рабочих дня"],
    [`${fmt(2 * a, 0)}–${fmt(3 * a, 0)} м²`, "3 рабочих дня"],
    ["дальше", `каждые следующие ${fmt(a, 0)} м² добавляют 1 рабочий день`],
  ];
  el.innerHTML = rows.map(([s, d]) => `<tr><td>${s}</td><td>${d}</td></tr>`).join("");
}

function renderSpeed() {
  const p = params();
  const rows = [4, 6, 8, 10].map((m2day) => {
    const m2 = m2day * p.workDays;
    return `<tr>
      <td>${fmt(m2day, 1)} м² в день</td>
      <td class="num">${fmt(m2day / p.area, 1)}</td>
      <td class="num">${fmt(m2, 0)}</td>
      <td class="num">${rub(m2day * p.rateC)}</td>
      <td class="num">${rub(m2 * p.rateC)}</td>
    </tr>`;
  });
  $("speed-body").innerHTML = rows.join("");
  $("speed-days").textContent = fmt(p.workDays, 0);
}

function renderForecast() {
  const p = params();
  const area = p.models * p.area;
  const rows = [400, 500, 600].map((v) => {
    const months = area / v;
    const n = peopleFor(p, v, p.workDays);
    return `<tr><td>${fmt(v)} м² в месяц (${n} ${plural(n, "исполнитель", "исполнителя", "исполнителей")})</td><td class="num">${fmt(months, 1)}</td></tr>`;
  });
  $("forecast-body").innerHTML = rows.join("");
  $("forecast-area").textContent = fmt(area, 0);
}

function renderExample() {
  const p = params();
  const positions = [
    { name: "Позиция 1", s: 8.4 },
    { name: "Позиция 2", s: 6.2 },
    { name: "Позиция 3", s: 2.6 },
    { name: "Позиция 4", s: 2.5 },
  ];
  let totalS = 0;
  let totalC = 0;
  let totalK = 0;
  const rows = positions.map((pos) => {
    const c = pos.s * p.rateC;
    const k = pos.s * p.rateK;
    totalS += pos.s;
    totalC += c;
    totalK += k;
    const days = Math.max(1, Math.ceil(pos.s / p.prod - 1e-9));
    return `<tr><td>${pos.name}</td><td class="num">${fmt(pos.s, 1)}</td>
      <td class="num">${days}</td>
      <td class="num">${rub(c)}</td><td class="num">${rub(k)}</td></tr>`;
  });
  rows.push(`<tr><td><strong>Итого</strong></td><td class="num"><strong>${fmt(totalS, 1)}</strong></td>
    <td class="num"></td>
    <td class="num"><strong>${rub(totalC)}</strong></td><td class="num"><strong>${rub(totalK)}</strong></td></tr>`);
  $("example-body").innerHTML = rows.join("");
}

/* ---------- Формулы калькулятора с цветной подсветкой переменных ---------- */

/* Поля ввода: id поля -> ключ переменной */
const FIELD_VARS = {
  "c-volume": "V",
  "c-area": "S",
  "c-models": "M",
  "c-rate-c": "Rc",
  "c-rate-k": "Rk",
  "c-tax-usn": "Tu",
  "c-tax-npd": "Tn",
  "c-prod": "P",
  "c-days": "D",
  "c-load": "L",
  "c-team": "IG",
  "c-deadline": "RS",
};

/* Обозначения: sym - как в формуле, kind: in - поле ввода, mid - промежуточная величина, const - константа */
const VARS = {
  V: { sym: "V", kind: "in", name: "Объём в месяц" },
  S: { sym: "S", kind: "in", name: "Площадь позиции (средняя)" },
  M: { sym: "ПП", kind: "in", name: "Позиций в программе" },
  Rc: { sym: "СИ", kind: "in", name: "Ставка исполнителю" },
  Rk: { sym: "СП", kind: "in", name: "Ставка проверки" },
  Tu: { sym: "НУ", kind: "in", name: "Налог подрядчика (УСН), доля" },
  Tn: { sym: "НС", kind: "in", name: "Налог самозанятого, доля" },
  P: { sym: "ВИ", kind: "in", name: "Выработка исполнителя" },
  D: { sym: "РД", kind: "in", name: "Рабочих дней в месяц" },
  L: { sym: "ЗГ", kind: "in", name: "Целевая загрузка, доля" },
  IG: { sym: "ИГ", kind: "in", name: "Исполнителей в группе" },
  RS: { sym: "РС", kind: "in", name: "Рабочих дней до срока заказчика" },
  Z: { sym: "ПМ", kind: "mid", name: "Позиций в месяц" },
  N: { sym: "ИС", kind: "mid", name: "Исполнителей нужно на объём" },
  Q: { sym: "МИ", kind: "mid", name: "М² на одного исполнителя" },
  W: { sym: "МГ", kind: "mid", name: "Мощность группы в месяц" },
  X: { sym: "МС", kind: "mid", name: "Мощность группы до срока" },
  R1: { sym: "СД1", kind: "mid", name: "Ставка по договору, налог УСН" },
  R2: { sym: "СД2", kind: "mid", name: "Ставка по договору, налог УСН и самозанятых" },
  G: { sym: "ДГ", kind: "const", name: "Доля мощности для гарантии (0,85)" },
};

function formulaValues(p) {
  const N = peopleFor(p, p.volume, p.workDays);
  const Q = p.volume / N;
  const val = {
    V: fmt(p.volume, 0),
    S: fmt(p.area, 1),
    M: fmt(p.models, 0),
    Rc: fmt(p.rateC, 0),
    Rk: fmt(p.rateK, 0),
    Tu: fmt(p.taxUsn, 2),
    Tn: fmt(p.taxNpd, 2),
    P: fmt(p.prod, 1),
    D: fmt(p.workDays, 0),
    L: fmt(p.load, 2),
    Z: fmt(p.volume / p.area, 0),
    N: String(N),
    Q: fmt(Q, 0),
    IG: fmt(p.team, 0),
    RS: fmt(p.deadline, 0),
    W: fmt(p.team * p.prod * p.workDays, 0),
    X: fmt(p.team * p.prod * p.deadline, 0),
    R1: fmt(contractRate(p, false), 0),
    R2: fmt(contractRate(p, true), 0),
    G: fmt(GUARANTEE, 2),
  };
  return { N, Q, val };
}

const chip = (key, text) =>
  `<span class="fx fx-${VARS[key].kind} fx-${key}">${text}</span>`;

function renderFormulas() {
  const host = $("formula-body");
  if (!host) return;
  const p = params();
  const { N, Q, val } = formulaValues(p);
  const sym = (tpl) => tpl.replace(/\{(\w+)\}/g, (_, k) => chip(k, VARS[k].sym));
  const num_ = (tpl) => tpl.replace(/\{(\w+)\}/g, (_, k) => chip(k, val[k]));
  const res = (text) => `<span class="fx-res">${text}</span>`;

  const rows = [
    ["Позиций в месяц", "{Z} = {V} / {S}", fmt(p.volume / p.area, 0)],
    ["Позиций в рабочий день", "{Z} / {D}", fmt(p.volume / p.area / p.workDays, 1)],
    [
      "Исполнителей нужно на объём",
      "{N} = ⌈ {V} / ({P} × {D} × {L}) ⌉, не меньше 1",
      String(N),
    ],
    ["М² на одного исполнителя в месяц", "{Q} = {V} / {N}", fmt(Q, 0)],
    ["М² на одного исполнителя в неделю", "{Q} / ({D} / 5), 5 рабочих дней в неделю", fmt(Q / (p.workDays / 5), 0)],
    ["Доход исполнителя в месяц", "{Q} × {Rc}", rub(Q * p.rateC)],
    ["Загрузка исполнителя", "{Q} / ({P} × {D})", fmt((Q / (p.prod * p.workDays)) * 100, 0) + "%"],
    ["Мощность группы, м² в месяц", "{W} = {IG} × {P} × {D}", fmt(p.team * p.prod * p.workDays, 0)],
    ["Объём для гарантии в договоре, м² в месяц", "{W} × {G}", fmt(p.team * p.prod * p.workDays * GUARANTEE, 0)],
    ["Мощность группы до срока заказчика, м²", "{X} = {IG} × {P} × {RS}", fmt(p.team * p.prod * p.deadline, 0)],
    ["Гарантия к сроку заказчика, м²", "{X} × {G}", fmt(p.team * p.prod * p.deadline * GUARANTEE, 0)],
    ["Фонд оплаты исполнителям", "{V} × {Rc}", rub(p.volume * p.rateC)],
    ["Проверка и координация", "{V} × {Rk}", rub(p.volume * p.rateK)],
    ["Ставка по договору, ₽/м² (налог УСН)", "{R1} = ({Rc} + {Rk}) / (1 − {Tu})", fmt(contractRate(p, false), 0)],
    [
      "Ставка по договору, ₽/м² (налог УСН и самозанятых)",
      "{R2} = ({Rc} / (1 − {Tn}) + {Rk}) / (1 − {Tu})",
      fmt(contractRate(p, true), 0),
    ],
    ["Расходы заказчика в месяц", "{V} × {R2}", rub(p.volume * contractRate(p, true))],
    ["Срок закрытия программы, месяцев", "{M} × {S} / {V}", fmt((p.models * p.area) / (p.volume || 1), 1)],
    ["Срок одной позиции, рабочих дней", "⌈ площадь позиции / {P} ⌉, не меньше 1", fmt(Math.max(1, Math.ceil(p.area / p.prod - 1e-9)), 0) + " (для средней позиции)"],
  ].map(([name, f, r]) => {
    const f1 = f;
    return `<tr><td>${name}</td><td class="fx-line">${sym(f1)}</td><td class="fx-line">${num_(f1)}</td><td class="num">${res(r)}</td></tr>`;
  });
  host.innerHTML = rows.join("");

  $("formula-legend").innerHTML =
    Object.keys(VARS)
      .map((k) => `<span class="fx-leg">${chip(k, VARS[k].sym)} ${VARS[k].name}</span>`)
      .join("");
}

/* Цветные метки у полей калькулятора */
function decorateFields() {
  Object.entries(FIELD_VARS).forEach(([id, key]) => {
    const input = $(id);
    if (!input) return;
    const label = input.parentElement.querySelector("label");
    if (label && !label.querySelector(".fx")) {
      label.insertAdjacentHTML("afterbegin", chip(key, VARS[key].sym) + " ");
    }
    input.classList.add("fx-field", "fx-field-" + key);
  });
}

function renderAll() {
  renderCalc();
  renderFormulas();
  renderPlan();
  renderScenarios();
  renderDueTable();
  renderSpeed();
  renderForecast();
  renderExample();
  if (typeof window.renderInternal === "function") window.renderInternal();
  if (typeof window.labelTables === "function") window.labelTables();
}

document.addEventListener("DOMContentLoaded", () => {
  decorateFields();
  document.querySelectorAll(".calc-grid input, .calc-compact input").forEach((el) => {
    el.addEventListener("input", renderAll);
  });
  renderAll();
});
