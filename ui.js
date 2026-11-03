"use strict";

/* Интерфейс страницы: подписи для таблиц-карточек на телефоне, подсветка раздела в меню,
   кнопка «наверх», сворачиваемые формулы. Работает и без этого файла (таблицы просто прокручиваются). */

(function () {
  var mobile = window.matchMedia("(max-width: 760px)");

  /* Каждой ячейке таблицы с 3+ колонками ставим подпись из шапки: на телефоне
     таблица превращается в карточки, и значение остаётся с названием колонки. */
  function labelTables() {
    document.querySelectorAll("table").forEach(function (t) {
      var head = t.querySelector("thead tr");
      if (!head) return;
      var labels = Array.prototype.map.call(head.children, function (th) {
        return th.textContent.replace(/\s+/g, " ").trim();
      });
      // короткие таблицы из 1–2 колонок остаются таблицами; длинный текст — карточки
      var longText = Array.prototype.some.call(t.querySelectorAll("tbody td"), function (td) {
        return td.textContent.length > 70;
      });
      if (labels.length < 3 && !(labels.length === 2 && longText)) return;
      var badgeFirst = labels[0] === ""; // таблица «бейдж + пункт + содержание»
      t.classList.add("tcards");
      if (badgeFirst) t.classList.add("t-badge");
      t.querySelectorAll("tbody tr").forEach(function (tr) {
        var col = 0;
        Array.prototype.forEach.call(tr.children, function (td) {
          var span = td.colSpan || 1;
          var label = span > 1 || col === 0 || badgeFirst ? "" : labels[col] || "";
          td.setAttribute("data-label", label);
          col += span;
        });
      });
    });
  }
  window.labelTables = labelTables;

  function initNav() {
    var nav = document.querySelector(".site-nav-links");
    if (!nav || !("IntersectionObserver" in window)) return;
    var links = Array.prototype.slice.call(nav.querySelectorAll("a[href^='#']"));
    var byId = {};
    links.forEach(function (a) {
      byId[a.getAttribute("href").slice(1)] = a;
    });
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var a = byId[e.target.id];
          if (!a) return;
          links.forEach(function (l) {
            l.classList.remove("active");
          });
          a.classList.add("active");
          nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: "smooth" });
        });
      },
      { rootMargin: "-25% 0px -65% 0px" }
    );
    Object.keys(byId).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) io.observe(s);
    });
  }

  function initToTop() {
    var b = document.createElement("button");
    b.className = "to-top";
    b.type = "button";
    b.setAttribute("aria-label", "Наверх");
    b.textContent = "↑";
    b.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    document.body.appendChild(b);
    window.addEventListener(
      "scroll",
      function () {
        b.classList.toggle("show", window.scrollY > 900);
      },
      { passive: true }
    );
  }

  function initDetails() {
    var d = document.getElementById("fx-details");
    if (d) d.open = !mobile.matches;
    window.addEventListener("beforeprint", function () {
      document.querySelectorAll("details").forEach(function (x) {
        x.open = true;
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    labelTables();
    initNav();
    initToTop();
    initDetails();
  });
})();
