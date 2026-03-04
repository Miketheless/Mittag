/**
 * Admin Mittagsmenü – Wirtshaus Metzenhof
 * Monatsübersicht: Datum/Wochentag (Mi–Fr), Vorspeise, Hauptspeise
 * Tagesübersicht: Buchungsstatistik
 */

const SCRIPT_BASE = "https://script.google.com/macros/s/AKfycbytQIEJfKdPQIuH7LrNZeBNbbv3LuQ5f2MduFYopn-bu0ojxCtxPVuKf6kvkWOyawQ0Og/exec";

let adminKey = "";

function $(id) { return document.getElementById(id); }

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function getCalendarWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "–";
  const [y, m, d] = String(dateStr).trim().split("T")[0].split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  const wd = WOCHENTAGE[date.getDay()] || "–";
  return `${wd}, ${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;
}

function fillMonthYearSelects() {
  const now = new Date();
  const yearSel = $("menu-year");
  const monthSel = $("menu-month");
  if (!yearSel || !monthSel) return;

  const months = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 1; y++) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    if (y === now.getFullYear()) opt.selected = true;
    yearSel.appendChild(opt);
  }
  months.forEach((name, i) => {
    const opt = document.createElement("option");
    opt.value = i + 1;
    opt.textContent = name;
    if (i === now.getMonth()) opt.selected = true;
    monthSel.appendChild(opt);
  });
}

async function fetchMenuMonth(adminKey, year, month) {
  const params = new URLSearchParams({
    action: "mittag_admin_menu_month",
    admin_key: adminKey,
    year: String(year),
    month: String(month)
  });
  const res = await fetch(SCRIPT_BASE + "?" + params);
  return res.json();
}

async function saveMenu(adminKey, data) {
  const params = new URLSearchParams({
    action: "mittag_admin_save_menu",
    admin_key: adminKey,
    date: data.date,
    vorspeise: data.vorspeise,
    hauptspeise: data.hauptspeise,
    preis_basis: String(data.preis_basis || 15),
    preis_rabatt: String(data.preis_rabatt || 12),
    aktiv: data.aktiv ? "true" : "false"
  });
  const res = await fetch(SCRIPT_BASE + "?" + params);
  return res.json();
}

async function fetchOverview(adminKey, dateId) {
  const params = new URLSearchParams({ action: "mittag_admin_overview", admin_key: adminKey, date: dateId });
  const res = await fetch(SCRIPT_BASE + "?" + params);
  return res.json();
}

function renderMonthTable(menus) {
  const container = $("month-menu-container");
  if (!menus || menus.length === 0) {
    container.innerHTML = '<p class="text-muted">Keine Mittagstage in diesem Monat.</p>';
    return;
  }

  let lastKw = -1;
  let html = `
    <table class="month-table">
      <thead>
        <tr>
          <th>Datum</th>
          <th>Vorspeise</th>
          <th>Hauptspeise</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const m of menus) {
    const date = new Date(m.date);
    const kw = getCalendarWeek(date);
    if (kw !== lastKw) {
      lastKw = kw;
      html += `<tr class="kw-row"><td colspan="3">KW ${kw}</td></tr>`;
    }
    const v = (m.vorspeise || "").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const h = (m.hauptspeise || "").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const preisBasis = m.preis_basis || 15;
    const preisRabatt = m.preis_rabatt || 12;
    const aktiv = m.aktiv ? "1" : "0";
    html += `
      <tr data-date="${m.date}" data-preis-basis="${preisBasis}" data-preis-rabatt="${preisRabatt}" data-aktiv="${aktiv}">
        <td class="date-cell">${formatDateDisplay(m.date)}</td>
        <td><input type="text" class="menu-vorspeise" data-date="${m.date}" value="${v}" placeholder="z.B. Suppe des Tages"></td>
        <td><input type="text" class="menu-hauptspeise" data-date="${m.date}" value="${h}" placeholder="z.B. Schnitzel mit Erdäpfelsalat"></td>
      </tr>
    `;
  }

  html += "</tbody></table>";
  container.innerHTML = html;

  const saveOnChange = async (e) => {
    const input = e.target;
    const date = input.dataset.date;
    if (!date || !adminKey) return;
    const row = input.closest("tr");
    if (!row?.dataset?.date) return;
    const vorspeiseEl = row.querySelector(".menu-vorspeise");
    const hauptspeiseEl = row.querySelector(".menu-hauptspeise");

    const vorspeise = vorspeiseEl?.value?.trim() || "";
    const hauptspeise = hauptspeiseEl?.value?.trim() || "";
    const preisBasis = parseInt(row.dataset.preisBasis, 10) || 15;
    const preisRabatt = parseInt(row.dataset.preisRabatt, 10) || 12;
    const aktiv = row.dataset.aktiv === "1";

    try {
      const result = await saveMenu(adminKey, {
        date,
        vorspeise,
        hauptspeise,
        preis_basis: preisBasis,
        preis_rabatt: preisRabatt,
        aktiv
      });
      if (result.ok) {
        const badge = document.createElement("span");
        badge.textContent = " ✓";
        badge.style.color = "var(--color-success, green)";
        badge.style.fontSize = "0.85rem";
        input.parentElement.appendChild(badge);
        setTimeout(() => badge.remove(), 1500);
      }
    } catch (err) {
      console.warn("Speichern fehlgeschlagen:", err);
    }
  };

  container.querySelectorAll(".menu-vorspeise, .menu-hauptspeise").forEach(input => {
    input.addEventListener("blur", saveOnChange);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
    });
  });
}

async function loadMenuMonth() {
  const year = parseInt($("menu-year").value, 10);
  const month = parseInt($("menu-month").value, 10);
  if (isNaN(year) || isNaN(month)) return;

  const container = $("month-menu-container");
  container.innerHTML = "<p>Wird geladen...</p>";

  try {
    const res = await fetchMenuMonth(adminKey, year, month);
    if (res.ok && res.menus) {
      renderMonthTable(res.menus);
    } else {
      container.innerHTML = '<p class="message error">' + (res.message || "Fehler beim Laden") + "</p>";
    }
  } catch (e) {
    container.innerHTML = '<p class="message error">Fehler: ' + e.message + "</p>";
  }
}

function renderOverview(data) {
  const container = $("overview-content");
  if (!data.ok) {
    container.innerHTML = '<p class="message error">' + (data.message || "Fehler") + "</p>";
    return;
  }

  let html = `
    <table class="overview-table">
      <thead>
        <tr>
          <th>Slot</th>
          <th>Anzahl Buchungen</th>
          <th>Umsatz</th>
          <th>Rabatt-Buchungen</th>
        </tr>
      </thead>
      <tbody>
  `;
  (data.slots || []).forEach(row => {
    html += `<tr>
      <td>${row.slot || "–"}</td>
      <td>${row.anzahl || 0}</td>
      <td>€ ${(row.umsatz || 0).toFixed(2)}</td>
      <td>${row.rabatt_count || 0}</td>
    </tr>`;
  });
  const g = data.gesamt || {};
  html += `<tr class="overview-total">
    <td>Gesamt</td>
    <td>${g.menues || 0}</td>
    <td>€ ${(g.umsatz || 0).toFixed(2)}</td>
    <td>${g.rabatt_gesamt || 0}</td>
  </tr></tbody></table>`;
  html += `<p style="margin-top:1rem; font-size:0.9rem; color: var(--color-text-muted);">Datum: ${data.date}</p>`;
  container.innerHTML = html;
}

async function loadOverview() {
  const dateId = $("overview-date").value;
  if (!dateId) return;
  $("overview-content").innerHTML = "<p>Wird geladen...</p>";
  try {
    const res = await fetchOverview(adminKey, dateId);
    renderOverview(res);
  } catch (e) {
    $("overview-content").innerHTML = '<p class="message error">Fehler: ' + e.message + "</p>";
  }
}

async function handleLogin() {
  const key = ($("admin-key").value || "").trim();
  if (!key) {
    $("login-message").textContent = "Bitte Schlüssel eingeben";
    $("login-message").className = "message error";
    return;
  }
  $("login-btn").disabled = true;
  $("login-btn").textContent = "Prüfe...";
  try {
    const now = new Date();
    const res = await fetchMenuMonth(key, now.getFullYear(), now.getMonth() + 1);
    if (res.ok !== false) {
      adminKey = key;
      $("login-section").classList.add("hidden");
      $("mittag-panel").classList.remove("hidden");
      fillMonthYearSelects();
      $("overview-date").value = now.toISOString().slice(0, 10);
      loadMenuMonth();
    } else {
      $("login-message").textContent = res.message || "Ungültiger Admin-Schlüssel";
      $("login-message").className = "message error";
    }
  } catch (e) {
    $("login-message").textContent = "Verbindungsfehler";
    $("login-message").className = "message error";
  }
  $("login-btn").disabled = false;
  $("login-btn").textContent = "Anmelden";
}

document.addEventListener("DOMContentLoaded", () => {
  $("login-btn")?.addEventListener("click", handleLogin);
  $("admin-key")?.addEventListener("keypress", (e) => { if (e.key === "Enter") handleLogin(); });
  $("load-menu-btn")?.addEventListener("click", loadMenuMonth);

  document.querySelectorAll(".mittag-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".mittag-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("tab-" + tab.dataset.tab)?.classList.add("active");
      if (tab.dataset.tab === "overview") loadOverview();
      else if (tab.dataset.tab === "menu") loadMenuMonth();
    });
  });

  $("load-overview-btn")?.addEventListener("click", loadOverview);
});
