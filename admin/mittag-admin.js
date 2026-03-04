/**
 * Admin Mittagsmenü – Wirtshaus Metzenhof
 * Menü bearbeiten (Mi–Fr), Tagesübersicht
 */

const SCRIPT_BASE = "https://script.google.com/macros/s/AKfycbytQIEJfKdPQIuH7LrNZeBNbbv3LuQ5f2MduFYopn-bu0ojxCtxPVuKf6kvkWOyawQ0Og/exec";

let adminKey = "";

function $(id) { return document.getElementById(id); }

function nextMittagDay() {
  const d = new Date();
  const day = d.getDay();
  let add = 0;
  if (day <= 2) add = 3 - day;      // Mon/Tue -> Wed
  else if (day <= 4) add = 4 - day; // Wed -> Thu, Thu -> Fri
  else if (day <= 5) add = 5 - day; // Fri -> today
  else add = 3;                      // Sat/Sun -> Wed
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

function setDateInputs() {
  const d = nextMittagDay();
  const menuDate = $("menu-date");
  const overviewDate = $("overview-date");
  if (menuDate) menuDate.value = d;
  if (overviewDate) overviewDate.value = new Date().toISOString().slice(0, 10);
}

async function fetchMenu(adminKey, dateId) {
  const params = new URLSearchParams({ action: "mittag_admin_menu", admin_key: adminKey, date: dateId });
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
    preis_basis: data.preis_basis,
    preis_rabatt: data.preis_rabatt,
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

function renderMenuForm(menu) {
  const container = $("day-forms");
  const wochentage = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const wd = wochentage[menu.weekday] || "–";

  container.innerHTML = `
    <div class="day-form">
      <h3>${wd} – ${menu.date}</h3>
      <input type="hidden" id="form-date" value="${menu.date}">
      <label>Vorspeise</label>
      <input type="text" id="form-vorspeise" value="${(menu.vorspeise || "").replace(/"/g, "&quot;")}" placeholder="z.B. Suppe des Tages">
      <label>Hauptspeise</label>
      <input type="text" id="form-hauptspeise" value="${(menu.hauptspeise || "").replace(/"/g, "&quot;")}" placeholder="z.B. Schnitzel mit Erdäpfelsalat">
      <label>Basispreis (€)</label>
      <input type="number" id="form-preis-basis" value="${menu.preis_basis || 15}" min="1" step="0.01">
      <label>Rabattpreis (€, bis 10:00)</label>
      <input type="number" id="form-preis-rabatt" value="${menu.preis_rabatt || 12}" min="1" step="0.01">
      <div class="aktiv-row">
        <input type="checkbox" id="form-aktiv" ${menu.aktiv ? "checked" : ""}>
        <label for="form-aktiv" style="margin:0;">Aktivieren (Menü anzeigen & buchbar)</label>
      </div>
      <button type="button" class="btn-save" id="save-menu-btn">Speichern</button>
      <span id="save-status" style="margin-left: 1rem;"></span>
    </div>
  `;

  $("save-menu-btn").addEventListener("click", async () => {
    const btn = $("save-menu-btn");
    const status = $("save-status");
    btn.disabled = true;
    status.textContent = "Speichere...";
    try {
      const result = await saveMenu(adminKey, {
        date: $("form-date").value,
        vorspeise: $("form-vorspeise").value,
        hauptspeise: $("form-hauptspeise").value,
        preis_basis: parseInt($("form-preis-basis").value) || 15,
        preis_rabatt: parseInt($("form-preis-rabatt").value) || 12,
        aktiv: $("form-aktiv").checked
      });
      if (result.ok) {
        status.textContent = "✓ Gespeichert";
        status.style.color = "var(--color-success)";
      } else {
        status.textContent = "Fehler: " + (result.message || "Unbekannt");
        status.style.color = "var(--color-error)";
      }
    } catch (e) {
      status.textContent = "Fehler: " + e.message;
      status.style.color = "var(--color-error)";
    }
    btn.disabled = false;
  });
}

async function loadMenu() {
  const dateId = $("menu-date").value;
  if (!dateId) return;
  try {
    const res = await fetchMenu(adminKey, dateId);
    if (res.ok && res.menu) {
      renderMenuForm(res.menu);
    } else {
      $("day-forms").innerHTML = '<p class="text-muted">Kein Eintrag für dieses Datum. Formular ausfüllen und Speichern.</p>';
      const d = new Date(dateId);
      renderMenuForm({
        date: dateId,
        weekday: d.getDay(),
        vorspeise: "",
        hauptspeise: "",
        preis_basis: 15,
        preis_rabatt: 12,
        aktiv: false
      });
    }
  } catch (e) {
    $("day-forms").innerHTML = '<p class="message error">Fehler beim Laden: ' + e.message + '</p>';
  }
}

function renderOverview(data) {
  const container = $("overview-content");
  if (!data.ok) {
    container.innerHTML = '<p class="message error">' + (data.message || "Fehler") + '</p>';
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
  $("overview-content").innerHTML = '<p>Wird geladen...</p>';
  try {
    const res = await fetchOverview(adminKey, dateId);
    renderOverview(res);
  } catch (e) {
    $("overview-content").innerHTML = '<p class="message error">Fehler: ' + e.message + '</p>';
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
    const res = await fetchMenu(key, new Date().toISOString().slice(0, 10));
    if (res.ok !== false) {
      adminKey = key;
      $("login-section").classList.add("hidden");
      $("mittag-panel").classList.remove("hidden");
      setDateInputs();
      loadMenu();
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
  setDateInputs();

  $("login-btn").addEventListener("click", handleLogin);
  $("admin-key").addEventListener("keypress", e => { if (e.key === "Enter") handleLogin(); });

  document.querySelectorAll(".mittag-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".mittag-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
      if (tab.dataset.tab === "overview") loadOverview();
    });
  });

  $("load-menu-btn").addEventListener("click", loadMenu);
  $("load-overview-btn").addEventListener("click", loadOverview);
});
