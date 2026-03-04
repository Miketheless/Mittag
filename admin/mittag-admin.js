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

async function fetchJson(url) {
  const res = await fetch(url, { method: "GET", redirect: "follow" });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error("Backend antwortet nicht mit JSON. Prüfe SCRIPT_BASE und ob die Web-App neu bereitgestellt wurde.");
  }
}

async function fetchMenuMonth(adminKey, year, month) {
  const params = new URLSearchParams({
    action: "mittag_admin_menu_month",
    admin_key: adminKey,
    year: String(year),
    month: String(month)
  });
  return fetchJson(SCRIPT_BASE + "?" + params.toString());
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
  return fetchJson(SCRIPT_BASE + "?" + params.toString());
}

async function fetchOverview(adminKey, dateId) {
  const params = new URLSearchParams({ action: "mittag_admin_overview", admin_key: adminKey, date: dateId });
  return fetchJson(SCRIPT_BASE + "?" + params.toString());
}

let currentMenusData = [];

function escapeHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderRowView(m) {
  const preisBasis = m.preis_basis || 15;
  const preisRabatt = m.preis_rabatt || 12;
  const aktiv = m.aktiv ? "1" : "0";
  const vText = m.vorspeise ? escapeHtml(m.vorspeise) : '<span class="text-muted">–</span>';
  const hText = m.hauptspeise ? escapeHtml(m.hauptspeise) : '<span class="text-muted">–</span>';
  const aktivBadge = m.aktiv
    ? '<span class="aktiv-badge yes">Aktiv</span>'
    : '<span class="aktiv-badge no">Inaktiv</span>';
  return `<tr data-date="${m.date}" data-preis-basis="${preisBasis}" data-preis-rabatt="${preisRabatt}" data-aktiv="${aktiv}">
    <td class="date-cell">${formatDateDisplay(m.date)}</td>
    <td class="view-vorspeise">${vText}</td>
    <td class="view-hauptspeise">${hText}</td>
    <td class="aktiv-cell">${aktivBadge}</td>
    <td class="action-cell"><button type="button" class="btn-edit" data-date="${m.date}">Ändern</button></td>
  </tr>`;
}

function renderRowEdit(m) {
  const v = escapeHtml(m.vorspeise || "");
  const h = escapeHtml(m.hauptspeise || "");
  const preisBasis = m.preis_basis || 15;
  const preisRabatt = m.preis_rabatt || 12;
  const aktivChecked = m.aktiv ? " checked" : "";
  return `<tr data-date="${m.date}" data-preis-basis="${preisBasis}" data-preis-rabatt="${preisRabatt}">
    <td class="date-cell">${formatDateDisplay(m.date)}</td>
    <td><input type="text" class="edit-vorspeise" value="${v}" placeholder="z.B. Suppe des Tages"></td>
    <td><input type="text" class="edit-hauptspeise" value="${h}" placeholder="z.B. Schnitzel mit Erdäpfelsalat"></td>
    <td class="aktiv-cell"><label><input type="checkbox" class="edit-aktiv"${aktivChecked}> Aktiv (auf Buchungsseite anzeigen)</label></td>
    <td class="action-cell">
      <button type="button" class="btn-save-row">Speichern</button>
      <button type="button" class="btn-cancel">Abbrechen</button>
    </td>
  </tr>`;
}

function renderMonthTable(menus) {
  const container = $("month-menu-container");
  currentMenusData = menus;
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
          <th>Aktiv</th>
          <th>Aktion</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const m of menus) {
    const date = new Date(m.date);
    const kw = getCalendarWeek(date);
    if (kw !== lastKw) {
      lastKw = kw;
      html += `<tr class="kw-row"><td colspan="5">KW ${kw}</td></tr>`;
    }
    html += renderRowView(m);
  }

  html += "</tbody></table>";
  container.innerHTML = html;
}

function initMonthTableClickHandlers() {
  const container = $("month-menu-container");
  if (!container) return;
  container.addEventListener("click", async (e) => {
    const btnEdit = e.target.closest(".btn-edit");
    const btnSave = e.target.closest(".btn-save-row");
    const btnCancel = e.target.closest(".btn-cancel");
    const date = e.target.closest("tr[data-date]")?.dataset?.date;
    if (!date || (!btnEdit && !btnSave && !btnCancel)) return;

    if (btnEdit) {
      const menu = currentMenusData.find((m) => m.date === date);
      if (!menu) return;
      const row = btnEdit.closest("tr");
      const temp = document.createElement("tbody");
      temp.innerHTML = renderRowEdit(menu);
      const newRow = temp.querySelector("tr");
      row.replaceWith(newRow);
      newRow.querySelector(".edit-vorspeise")?.focus();
    }

    if (btnCancel) {
      const menu = currentMenusData.find((m) => m.date === date);
      if (!menu) return;
      const row = btnCancel.closest("tr");
      const temp = document.createElement("tbody");
      temp.innerHTML = renderRowView(menu);
      const newRow = temp.querySelector("tr");
      row.replaceWith(newRow);
    }

    if (btnSave) {
      const row = btnSave.closest("tr");
      const menu = currentMenusData.find((m) => m.date === date);
      if (!menu) return;
      const vInput = row.querySelector(".edit-vorspeise");
      const hInput = row.querySelector(".edit-hauptspeise");
      const aktivCheck = row.querySelector(".edit-aktiv");
      const vorspeise = vInput?.value?.trim() || "";
      const hauptspeise = hInput?.value?.trim() || "";
      const aktiv = aktivCheck?.checked ?? false;
      btnSave.disabled = true;
      btnSave.textContent = "…";
      try {
        const result = await saveMenu(adminKey, {
          date,
          vorspeise,
          hauptspeise,
          preis_basis: parseInt(row.dataset.preisBasis, 10) || 15,
          preis_rabatt: parseInt(row.dataset.preisRabatt, 10) || 12,
          aktiv
        });
        if (result.ok) {
          const updated = { ...menu, vorspeise, hauptspeise, aktiv };
          const idx = currentMenusData.findIndex((m) => m.date === date);
          if (idx >= 0) currentMenusData[idx] = updated;
          const temp = document.createElement("tbody");
          temp.innerHTML = renderRowView(updated);
          row.replaceWith(temp.querySelector("tr"));
        } else {
          alert("Speichern fehlgeschlagen: " + (result.message || "Unbekannt") + "\n\nPrüfe: Admin-Schlüssel stimmt mit Settings-ADMIN_KEY überein? Backend neu bereitgestellt?");
        }
      } catch (err) {
        alert("Fehler: " + err.message);
      }
      btnSave.disabled = false;
      btnSave.textContent = "Speichern";
    }
  });
}

function ensureMonthTableHandlers() {
  const container = $("month-menu-container");
  if (!container || container.dataset.handlersBound) return;
  container.dataset.handlersBound = "1";
  initMonthTableClickHandlers();
}

async function loadMenuMonth() {
  const year = parseInt($("menu-year").value, 10);
  const month = parseInt($("menu-month").value, 10);
  if (isNaN(year) || isNaN(month)) return;

  const container = $("month-menu-container");
  container.innerHTML = "<p>Wird geladen...</p>";

  try {
    const res = await fetchMenuMonth(adminKey, year, month);
    if (res.ok && Array.isArray(res.menus)) {
      renderMonthTable(res.menus);
    } else {
      const msg = res.message || "Fehler beim Laden";
      container.innerHTML = '<p class="message error">' + escapeHtml(msg) + "</p><p style='font-size:0.85rem; color:#666; margin-top:0.5rem;'>Hinweis: Ist die backend.gs im Google Apps Script aktuell und neu bereitgestellt?</p>";
    }
  } catch (e) {
    container.innerHTML = '<p class="message error">Fehler: ' + escapeHtml(e.message) + "</p><p style='font-size:0.85rem; color:#666; margin-top:0.5rem;'>Prüfe die Browser-Konsole (F12) und ob SCRIPT_BASE korrekt ist.</p>";
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
  ensureMonthTableHandlers();
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
