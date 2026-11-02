"use strict";

/* Расчёты на странице: все формулы собраны здесь.
   Значения по умолчанию - допущения, которые уточняются по итогам пилота. */

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

const SIGNED = (n) => {
  const cls = n >= 0 ? "pos" : "neg";
  const sign = n >= 0 ? "+" : "−";
  return `<span class="${cls}">${sign}${rub(Math.abs(n))}</span>`;
};

/* Параметры расчёта из полей калькулятора */
function params() {
  return {
    volume: num("c-volume"),        // объём команды, м2 в месяц
    area: num("c-area") || 1,       // средняя площадь позиции, м2
    rateC: num("c-rate-c"),         // ставка исполнителю, руб/м2
    rateK: num("c-rate-k"),         // ставка проверяющему, руб/м2
    taxUsn: num("c-tax-usn") / 100, // налог ИП (УСН), доля
    taxNpd: num("c-tax-npd") / 100, // налог самозанятого, доля
    staffCost: num("c-staff-cost"), // полная стоимость штатного, руб/мес
    hoursDay: num("c-hours-day"),   // часов в день у исполнителя
    tItem: num("c-t-item") || 1,    // часов на позицию у исполнителя
    models: num("c-models"),        // число позиций в программе
    perPerson: 80,                  // комфортная загрузка, м2 на человека в месяц
    workDays: 21,
  };
}

/* Число исполнителей по правилу N = объём / 80 (минимум 1) */
const people = (p, volume) => Math.max(1, Math.round(volume / p.perPerson));

/* Ставка по договору, руб/м2 */
const contractRate = (p, withNpd) => {
  const base = withNpd ? p.rateC / (1 - p.taxNpd) : p.rateC;
  return (base + p.rateK) / (1 - p.taxUsn);
};

/* Загрузка исполнителя в долях от его часов в месяц */
const loadShare = (p, m2PerPerson) =>
  ((m2PerPerson / p.area) * p.tItem) / (p.hoursDay * p.workDays);

function renderCalc() {
  const p = params();
  const n = people(p, p.volume);
  const per = p.volume / n;
  const items = p.volume / p.area;
  const rate1 = contractRate(p, false);
  const rate2 = contractRate(p, true);
  const monthlyCost = p.volume * rate2;
  const breakeven = p.staffCost / rate2;

  const warnings = [];
  if (p.volume < 150) {
    warnings.push(
      '<div class="callout bad"><strong>Ниже 150 м² в месяц.</strong> Отдельная группа не нужна: объём закрывает один человек.</div>'
    );
  } else if (p.volume < 250) {
    warnings.push(
      '<div class="callout warn"><strong>Ниже 250 м² в месяц.</strong> Это меньше нижней границы потока: людям не хватит загрузки.</div>'
    );
  } else if (p.volume >= 400) {
    warnings.push(
      '<div class="callout ok"><strong>Целевой поток (от 400 м² в месяц).</strong> Каждому исполнителю хватает загрузки.</div>'
    );
  }
  const share = loadShare(p, per);
  if (share > 1) {
    warnings.push(
      '<div class="callout warn">Нагрузка на исполнителя выше его часов: нужно больше людей.</div>'
    );
  }

  $("calc-out").innerHTML = `
    <div class="item"><div class="k">Позиций в месяц</div><div class="v">${fmt(items, 0)}</div></div>
    <div class="item"><div class="k">Исполнителей в основном составе</div><div class="v">${n}</div></div>
    <div class="item"><div class="k">На одного исполнителя, м²</div><div class="v">${fmt(per, 0)}</div></div>
    <div class="item"><div class="k">Доход исполнителя в месяц</div><div class="v">${rub(per * p.rateC)}</div></div>
    <div class="item"><div class="k">Загрузка его часов</div><div class="v">${fmt(share * 100, 0)}%</div></div>
    <div class="item"><div class="k">Фонд оплаты исполнителям</div><div class="v">${rub(p.volume * p.rateC)}</div></div>
    <div class="item"><div class="k">Проверка и координация</div><div class="v">${rub(p.volume * p.rateK)}</div></div>
    <div class="item"><div class="k">Ставка по договору, ₽/м² (налог УСН)</div><div class="v">${fmt(rate1, 0)}</div></div>
    <div class="item"><div class="k">То же, если налог исполнителей-самозанятых тоже компенсируется</div><div class="v">${fmt(rate2, 0)}</div></div>
    <div class="item"><div class="k">Расходы заказчика в месяц (по второй ставке)</div><div class="v">${rub(monthlyCost)}</div></div>
    <div class="item"><div class="k">Штатный конструктор выгоднее, если делает больше, м² в месяц</div><div class="v">${fmt(breakeven, 0)}</div></div>
    ${warnings.join("")}
  `;
}

const STAGES = [
  {
    name: "Недели 1–2 (пилот)",
    volume: 60,
    peopleText: "3–4",
    perText: "15–20 м², около 7,5–10 тыс. ₽",
    note: "Калибровка: сроки, правки, чек-лист. Первая заявка (4 позиции) плюс ещё около 8.",
  },
  {
    name: "Месяц 1 (всего)",
    volume: 150,
    note: "Для запаса и обучения можно взять 3 человека: около 25 тыс. ₽ каждому.",
    tag: "low",
  },
  {
    name: "Месяц 2",
    volume: 250,
    note: "Нижняя граница потока. К старту месяца 2 в очереди не меньше 40 позиций.",
    tag: "min",
  },
  {
    name: "Месяц 3 и далее",
    volume: 400,
    note: "Устойчивый поток, около 4 позиций в рабочий день.",
    tag: "target",
  },
  {
    name: "Масштабирование",
    volume: 600,
    note: "Больше 7–8 человек без платформы вести сложно.",
  },
];

const TAG_HTML = {
  min: '<span class="badge min">минимум для пилота</span>',
  target: '<span class="badge target">целевой поток</span>',
  low: '<span class="badge low">ниже границы потока</span>',
};

function renderStages() {
  const p = params();
  const rows = STAGES.map((s) => {
    const n = people(p, s.volume);
    const per = s.volume / n;
    const tag = s.tag ? " " + TAG_HTML[s.tag] : "";
    const cls = s.tag ? ` class="row-${s.tag}"` : "";
    const peopleCell = s.peopleText || n;
    const perCell = s.perText || `${fmt(per, 0)} м², ${rub(per * p.rateC)}`;
    return `<tr${cls}>
      <td>${s.name}${tag}</td>
      <td class="num">${fmt(s.volume)}</td>
      <td class="num">${fmt(s.volume / p.area, 0)}</td>
      <td class="num">${peopleCell}</td>
      <td>${perCell}</td>
      <td>${s.note}</td>
    </tr>`;
  });
  $("stages-body").innerHTML = rows.join("");
}

function renderSpeed() {
  const p = params();
  const hours = p.hoursDay * p.workDays;
  const rows = [3, 4, 6, 8].map((t) => {
    const items = hours / t;
    const m2 = items * p.area;
    return `<tr>
      <td>${t} ч на позицию</td>
      <td class="num">${fmt(items, 1)}</td>
      <td class="num">${fmt(m2, 0)}</td>
      <td class="num">${rub(m2 * p.rateC)}</td>
      <td class="num">${rub((p.rateC * p.area) / t)}</td>
    </tr>`;
  });
  $("speed-body").innerHTML = rows.join("");
  $("speed-hours").textContent = fmt(hours, 0);
}

function renderStaff() {
  const p = params();
  const rate2 = contractRate(p, true);
  const rows = [250, 400, 600].map((v) => {
    const cost = v * rate2;
    const cells = [80, 120, 170]
      .map((out) => {
        const staff = (v / out) * p.staffCost;
        return `<td class="num">${SIGNED(staff - cost)}</td>`;
      })
      .join("");
    return `<tr><td>${fmt(v)} м²</td><td class="num">${rub(cost)}</td>${cells}</tr>`;
  });
  $("staff-body").innerHTML = rows.join("");
}

function renderForecast() {
  const p = params();
  const area = p.models * p.area;
  const rows = [250, 400, 600].map((v) => {
    const months = area / v;
    return `<tr><td>${fmt(v)} м² в месяц</td><td class="num">${fmt(months, 1)}</td></tr>`;
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
    return `<tr><td>${pos.name}</td><td class="num">${fmt(pos.s, 1)}</td>
      <td class="num">${rub(c)}</td><td class="num">${rub(k)}</td></tr>`;
  });
  rows.push(`<tr><td><strong>Итого</strong></td><td class="num"><strong>${fmt(totalS, 1)}</strong></td>
    <td class="num"><strong>${rub(totalC)}</strong></td><td class="num"><strong>${rub(totalK)}</strong></td></tr>`);
  $("example-body").innerHTML = rows.join("");
}

function renderAll() {
  renderCalc();
  renderStages();
  renderSpeed();
  renderStaff();
  renderForecast();
  renderExample();
  if (typeof window.renderInternal === "function") window.renderInternal();
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".calc-grid input").forEach((el) => {
    el.addEventListener("input", renderAll);
  });
  renderAll();
});
