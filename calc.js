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
  };
}

/* Число исполнителей: объём / (выработка за период × целевая загрузка), вверх; минимум 1 */
const peopleFor = (p, volume, days) =>
  Math.max(1, Math.ceil(volume / (p.prod * days * p.load) - 1e-9));

/* Загрузка исполнителя в долях от его возможной выработки за период */
const loadShare = (p, m2PerPerson, days) => m2PerPerson / (p.prod * days);

/* Ставка по договору, руб/м2 */
const contractRate = (p, withNpd) => {
  const base = withNpd ? p.rateC / (1 - p.taxNpd) : p.rateC;
  return (base + p.rateK) / (1 - p.taxUsn);
};

function renderCalc() {
  const p = params();
  const n = peopleFor(p, p.volume, p.workDays);
  const per = p.volume / n;
  const items = p.volume / p.area;
  const rate1 = contractRate(p, false);
  const rate2 = contractRate(p, true);
  const monthlyCost = p.volume * rate2;
  const share = loadShare(p, per, p.workDays);

  const warnings = [];
  if (p.volume < 250) {
    warnings.push(
      '<div class="callout bad"><strong>Ниже 250 м² в месяц.</strong> Группа из нескольких человек не нужна: объём закрывают два исполнителя.</div>'
    );
  } else if (p.volume < 400) {
    warnings.push(
      '<div class="callout warn"><strong>Ниже 400 м² в месяц.</strong> Это меньше нижней границы потока: исполнителям не хватит загрузки.</div>'
    );
  } else if (p.volume >= 500) {
    warnings.push(
      '<div class="callout ok"><strong>Целевой поток (от 500 м² в месяц).</strong> Исполнители загружены полностью.</div>'
    );
  } else {
    warnings.push(
      '<div class="callout ok"><strong>Выше нижней границы потока (400 м² в месяц).</strong></div>'
    );
  }
  if (share > 1) {
    warnings.push(
      '<div class="callout warn">Нагрузка выше возможностей исполнителя: нужно больше людей.</div>'
    );
  }

  $("calc-out").innerHTML = `
    <div class="item"><div class="k">Позиций в месяц</div><div class="v">${fmt(items, 0)}</div></div>
    <div class="item"><div class="k">Позиций в рабочий день</div><div class="v">${fmt(items / p.workDays, 1)}</div></div>
    <div class="item"><div class="k">Исполнителей в основном составе</div><div class="v">${n}</div></div>
    <div class="item"><div class="k">На одного исполнителя, м²</div><div class="v">${fmt(per, 0)}</div></div>
    <div class="item"><div class="k">Доход исполнителя в месяц</div><div class="v">${rub(per * p.rateC)}</div></div>
    <div class="item"><div class="k">Загрузка исполнителя</div><div class="v">${fmt(share * 100, 0)}%</div></div>
    <div class="item"><div class="k">Фонд оплаты исполнителям</div><div class="v">${rub(p.volume * p.rateC)}</div></div>
    <div class="item"><div class="k">Проверка и координация</div><div class="v">${rub(p.volume * p.rateK)}</div></div>
    <div class="item"><div class="k">Ставка по договору, ₽/м² (налог УСН)</div><div class="v">${fmt(rate1, 0)}</div></div>
    <div class="item"><div class="k">То же, если налог исполнителей-самозанятых тоже компенсируется</div><div class="v">${fmt(rate2, 0)}</div></div>
    <div class="item"><div class="k">Расходы заказчика в месяц (по второй ставке)</div><div class="v">${rub(monthlyCost)}</div></div>
    ${warnings.join("")}
  `;
}

/* Этапы: объём задан сразу на полной нагрузке, без периода разгона */
const STAGES = [
  {
    name: "Недели 1–2 (запуск на полной нагрузке)",
    volume: 250,
    days: 10,
    note: "Первая партия из 4 позиций плюс остальная очередь. Первые три позиции каждого новичка проверяются полностью.",
  },
  {
    name: "Месяц 1 (всего)",
    volume: 500,
    days: 21,
    tag: "target",
    note: "Целевой поток: около 5 позиций в рабочий день.",
  },
  {
    name: "Месяц 2 и далее",
    volume: 500,
    days: 21,
    tag: "target",
    note: "Устойчивый поток при очереди не меньше недели вперёд.",
  },
  {
    name: "Минимальный поток",
    volume: 400,
    days: 21,
    tag: "min",
    note: "Ниже этого объёма исполнителям не хватает загрузки, оплата проверки не окупает время.",
  },
  {
    name: "Масштабирование",
    volume: 700,
    days: 21,
    note: "Больше 7–8 человек без платформы вести сложно.",
  },
];

const TAG_HTML = {
  min: '<span class="badge min">нижняя граница потока</span>',
  target: '<span class="badge target">целевой поток</span>',
};

function renderStages() {
  const p = params();
  const rows = STAGES.map((s) => {
    const n = peopleFor(p, s.volume, s.days);
    const per = s.volume / n;
    const tag = s.tag ? " " + TAG_HTML[s.tag] : "";
    const cls = s.tag ? ` class="row-${s.tag}"` : "";
    return `<tr${cls}>
      <td>${s.name}${tag}</td>
      <td class="num">${fmt(s.volume)}</td>
      <td class="num">${fmt(s.volume / p.area, 0)}</td>
      <td class="num">${n}</td>
      <td>${fmt(per, 0)} м², ${rub(per * p.rateC)}</td>
      <td>${s.note}</td>
    </tr>`;
  });
  $("stages-body").innerHTML = rows.join("");
}

function renderSpeed() {
  const p = params();
  const rows = [3, 4, 5, 5.5, 6].map((m2day) => {
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
    const days = Math.max(1, Math.ceil(pos.s / 6 - 1e-9));
    return `<tr><td>${pos.name}</td><td class="num">${fmt(pos.s, 1)}</td>
      <td class="num">${days}</td>
      <td class="num">${rub(c)}</td><td class="num">${rub(k)}</td></tr>`;
  });
  rows.push(`<tr><td><strong>Итого</strong></td><td class="num"><strong>${fmt(totalS, 1)}</strong></td>
    <td class="num"></td>
    <td class="num"><strong>${rub(totalC)}</strong></td><td class="num"><strong>${rub(totalK)}</strong></td></tr>`);
  $("example-body").innerHTML = rows.join("");
}

function renderAll() {
  renderCalc();
  renderStages();
  renderSpeed();
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
