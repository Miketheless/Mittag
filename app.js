/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MITTAGSMENÜ BUCHUNGSSYSTEM – Wirtshaus Metzenhof
 * mittag.metzenhof.at
 * 
 * - index.html: Menü des Tages + Slot-Auswahl (11:30, 12:00, 12:30, 13:00)
 * - buchen.html: Vorname, Nachname, Telefon, Slot, AGB
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ══════════════════════════════════════════════════════════════════════════════
// KONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  SCRIPT_BASE: "https://script.google.com/macros/s/AKfycbytQIEJfKdPQIuH7LrNZeBNbbv3LuQ5f2MduFYopn-bu0ojxCtxPVuKf6kvkWOyawQ0Og/exec",
  MAX_PARTICIPANTS: 4,
  BASE_URL: "https://mittag.metzenhof.at"
};

// ══════════════════════════════════════════════════════════════════════════════
// HILFSFUNKTIONEN
// ══════════════════════════════════════════════════════════════════════════════

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function parseDate(input) {
  if (!input) return null;
  if (input instanceof Date) {
    const d = input;
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }
  if (typeof input === "string") {
    const str = input.trim();
    if (str.includes("T")) {
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split("-").map(Number);
      return { year: y, month: m, day: d };
    }
  }
  return null;
}

function formatDateLong(str) {
  const p = parseDate(str);
  if (!p) return str;
  const date = new Date(p.year, p.month - 1, p.day);
  const wd = WEEKDAYS[date.getDay()];
  return `${wd}, ${String(p.day).padStart(2, "0")}.${String(p.month).padStart(2, "0")}.${p.year}`;
}

function formatDateShort(str) {
  const p = parseDate(str);
  if (!p) return str;
  return `${String(p.day).padStart(2, "0")}.${String(p.month).padStart(2, "0")}.${p.year}`;
}

/** Zeitwert (ISO-String oder "HH:MM") zu "HH:MM" formatieren */
function formatTimeDisplay(val) {
  if (!val) return "–";
  const s = String(val).trim();
  const isoMatch = s.match(/T(\d{1,2}):(\d{2})/);
  if (isoMatch) return isoMatch[1].padStart(2, "0") + ":" + isoMatch[2];
  if (/^\d{1,2}:\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return "–";
  return "–";
}

/** Datum aus slot_id oder date extrahieren (slot_id z.B. "langes-spiel_20260307_1") */
function getDateFromSlot(slot) {
  let str = (slot.date || slot.slot_id || "").toString().trim();
  if (str.includes("T")) str = str.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m = str.match(/(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return "";
}

function isFuture(str) {
  const p = parseDate(str);
  if (!p) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(p.year, p.month - 1, p.day);
  return date >= today;
}

function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function showMessage(text, type = "info") {
  const msgEl = document.getElementById("message");
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.className = `message ${type}`;
  msgEl.style.display = "block";
  if (type !== "error") setTimeout(() => { msgEl.style.display = "none"; }, 5000);
}

// ══════════════════════════════════════════════════════════════════════════════
// API
// ══════════════════════════════════════════════════════════════════════════════

async function fetchWorkshops() {
  try {
    const res = await fetch(`${CONFIG.SCRIPT_BASE}?action=workshops`);
    const data = await res.json();
    return data.ok ? (data.workshops || []) : [];
  } catch (e) {
    console.warn("Workshops API:", e.message);
    return [];
  }
}

async function fetchSlots(workshopId) {
  if (!workshopId) return [];
  try {
    const res = await fetch(`${CONFIG.SCRIPT_BASE}?action=slots&workshop_id=${encodeURIComponent(workshopId)}`);
    const data = await res.json();
    return data.ok ? (data.slots || []) : [];
  } catch (e) {
    console.warn("Slots API:", e.message);
    return [];
  }
}

/** Workshops + Slots in einem Aufruf (schneller) */
async function fetchWorkshopsWithSlots() {
  try {
    const res = await fetch(`${CONFIG.SCRIPT_BASE}?action=workshops_with_slots`);
    const data = await res.json();
    return data.ok ? (data.workshops_with_slots || []) : [];
  } catch (e) {
    console.warn("WorkshopsWithSlots API:", e.message);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// INDEX.HTML – ALLE WORKSHOPS MIT TERMINEN
// ══════════════════════════════════════════════════════════════════════════════

let workshopsWithSlots = [];

function selectSlot(workshopId, slotId) {
  window.location.href = `buchen.html?workshop_id=${encodeURIComponent(workshopId)}&slot=${encodeURIComponent(slotId)}`;
}
window.selectSlot = selectSlot;

function renderFilterDropdown() {
  const sel = document.getElementById("workshop-filter");
  if (!sel) return;

  const withSlots = workshopsWithSlots.filter(item => {
    const futureSlots = (item.slots || []).filter(s => isFuture(getDateFromSlot(s)));
    return futureSlots.length > 0;
  });

  sel.innerHTML = '<option value="">Alle Workshops</option>';
  withSlots.forEach(w => {
    const opt = document.createElement("option");
    opt.value = w.workshop.workshop_id;
    opt.textContent = w.workshop.title;
    sel.appendChild(opt);
  });

  sel.onchange = renderAllWorkshops;
}

function renderSlotCard(slot, workshop) {
  const dateId = getDateFromSlot(slot);
  const p = parseDate(dateId);
  if (!p) return "";

  const capacity = parseInt(slot.capacity) || CONFIG.MAX_PARTICIPANTS;
  const booked = parseInt(slot.booked) || 0;
  const free = capacity - booked;
  const dateObj = new Date(p.year, p.month - 1, p.day);
  const isBookable = free > 0 && (slot.status !== "FULL");

  let statusClass = "open";
  let statusText = `${free} von ${capacity} Plätzen frei`;
  if (free === 0) { statusClass = "full"; statusText = "Ausgebucht"; }
  else if (free <= 1) { statusClass = "few"; statusText = `Nur noch ${free} Platz frei`; }

  const clickAttr = isBookable ? `onclick="selectSlot('${workshop.workshop_id}','${slot.slot_id || dateId}')" style="cursor:pointer;"` : "";

  return `
    <div class="termin-card ${statusClass}" ${clickAttr} title="${isBookable ? "Termin auswählen" : "Ausgebucht"}">
      <div class="termin-datum">
        <div class="termin-weekday">${WEEKDAYS[dateObj.getDay()]}</div>
        <div class="termin-date">${String(p.day).padStart(2,"0")}.${String(p.month).padStart(2,"0")}.${p.year}</div>
      </div>
      <div class="termin-details">
        <div class="termin-info-row">
          <span class="info-icon">🕐</span>
          <span class="info-text">${formatTimeDisplay(slot.start)}–${formatTimeDisplay(slot.end)} Uhr</span>
        </div>
        <div class="termin-info-row">
          <span class="info-icon">👥</span>
          <span class="info-text status-${statusClass}">${statusText}</span>
        </div>
      </div>
      ${isBookable ? '<button type="button" class="termin-cta">Termin auswählen</button>' : '<div class="termin-cta-disabled">Nicht verfügbar</div>'}
    </div>
  `;
}

function renderAllWorkshops() {
  const filterValue = document.getElementById("workshop-filter")?.value || "";
  const container = document.getElementById("workshops-list");
  if (!container) return;

  let html = "";
  let toShow = filterValue
    ? workshopsWithSlots.filter(w => w.workshop.workshop_id === filterValue)
    : workshopsWithSlots;

  toShow = toShow.filter(item => {
    const futureSlots = (item.slots || []).filter(s => isFuture(getDateFromSlot(s)));
    return futureSlots.length > 0;
  });

  if (toShow.length === 0) {
    html = '<div class="termine-empty termine-loading"><span>Derzeit keine Termine verfügbar.</span></div>';
  } else {
    toShow.forEach(item => {
      const w = item.workshop;
      const futureSlots = (item.slots || []).filter(s => isFuture(getDateFromSlot(s)));
      futureSlots.sort((a, b) => {
        const da = parseDate(getDateFromSlot(a));
        const db = parseDate(getDateFromSlot(b));
        if (!da || !db) return 0;
        return new Date(da.year, da.month - 1, da.day) - new Date(db.year, db.month - 1, db.day);
      });

      html += `
        <div class="workshop-block" data-workshop-id="${w.workshop_id}">
          <h3>${w.title}</h3>
          <p class="workshop-desc">${w.description || ""}</p>
          <div class="workshop-meta">
            <span>Preis: € ${w.price_eur || 50}</span>
            <span>Dauer: ${w.duration_text || "–"}</span>
            <span>2–4 Teilnehmer</span>
          </div>
          <div class="workshop-slots-title">Verfügbare Termine:</div>
          <div class="termine-grid">
            ${futureSlots.map(s => renderSlotCard(s, w)).join("")}
          </div>
        </div>
      `;
    });
  }

  container.innerHTML = html;
}

async function loadAllWorkshopsAndSlots() {
  const container = document.getElementById("workshops-list");
  if (container) {
    container.innerHTML = '<div class="termine-loading"><div class="loading-spinner"></div><span>Termine werden geladen...</span></div>';
  }

  let data = await fetchWorkshopsWithSlots();
  if (!Array.isArray(data) || data.length === 0) {
    const workshops = await fetchWorkshops();
    const active = (workshops || []).filter(w => w.is_active !== false);
    const slotPromises = active.map(w => fetchSlots(w.workshop_id));
    const slotsArrays = await Promise.all(slotPromises);
    data = active.map((w, i) => ({ workshop: w, slots: slotsArrays[i] || [] }));
  }
  workshopsWithSlots = data;

  renderFilterDropdown();
  renderAllWorkshops();
}

// ══════════════════════════════════════════════════════════════════════════════
// BUCHEN.HTML – BUCHUNGSFORMULAR
// ══════════════════════════════════════════════════════════════════════════════

let selectedSlot = null;

function initBookingPage() {
  const workshopId = getUrlParam("workshop_id");
  const slotParam = getUrlParam("slot");

  if (!workshopId || !slotParam) {
    showNoSlotError();
    return;
  }

  fetchWorkshops().then(async workshops => {
    const workshop = workshops.find(w => w.workshop_id === workshopId);
    if (!workshop) {
      showNoSlotError("Workshop nicht gefunden.");
      return;
    }

    const slots = await fetchSlots(workshopId);
    const slot = slots.find(s => (s.slot_id || s.date || "").toString().split("T")[0] === (slotParam || "").toString().split("T")[0])
      || slots.find(s => String(s.slot_id) === String(slotParam))
      || (isFuture(slotParam) ? { slot_id: slotParam, date: slotParam, start: "10:00", end: "12:00", capacity: CONFIG.MAX_PARTICIPANTS, booked: 0 } : null);

    if (!slot) {
      showNoSlotError("Termin nicht gefunden.");
      return;
    }

    const free = (parseInt(slot.capacity) || CONFIG.MAX_PARTICIPANTS) - (parseInt(slot.booked) || 0);
    if (free <= 0) {
      showNoSlotError("Dieser Termin ist ausgebucht.");
      return;
    }

    selectedSlot = {
      id: slot.slot_id || slotParam,
      date: slot.date || slotParam,
      start: slot.start || "10:00",
      end: slot.end || "12:00",
      capacity: parseInt(slot.capacity) || CONFIG.MAX_PARTICIPANTS,
      booked: parseInt(slot.booked) || 0,
      workshop_id: workshopId,
      workshop
    };

    document.getElementById("slot_id").value = selectedSlot.id;
    document.getElementById("workshop_id").value = workshopId;

    displaySelectedSlot();
    renderParticipants(1);
  });
}

function showNoSlotError(message) {
  const form = document.querySelector(".booking-form-section");
  const err = document.getElementById("no-slot-section");
  if (form) form.style.display = "none";
  if (err) {
    err.style.display = "block";
    const p = err.querySelector("p");
    if (p && message) p.textContent = message;
  }
}

function displaySelectedSlot() {
  if (!selectedSlot) return;

  const free = selectedSlot.capacity - selectedSlot.booked;

  document.getElementById("selected-date-text").textContent = formatDateLong(selectedSlot.date);
  document.getElementById("slot-info-date").textContent = formatDateLong(selectedSlot.date);
  document.getElementById("slot-info-time").innerHTML = `<span class="time-label">Zeit:</span> <span class="time-value">${formatTimeDisplay(selectedSlot.start)}–${formatTimeDisplay(selectedSlot.end)} Uhr</span>`;
  document.getElementById("slot-info-free").textContent = free > 0 ? `✓ ${free} Plätze frei` : "Ausgebucht";
  document.getElementById("slot-info-workshop").textContent = selectedSlot.workshop ? selectedSlot.workshop.title : "";

  document.getElementById("summary-date").textContent = formatDateLong(selectedSlot.date);
  document.getElementById("summary-workshop").textContent = selectedSlot.workshop ? selectedSlot.workshop.title : "";

  updateOrderSummary();
}

function renderParticipants(count) {
  const container = document.getElementById("participants");
  if (!container) return;

  container.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const fs = document.createElement("fieldset");
    fs.className = "participant-fieldset";
    fs.innerHTML = `
      <legend>Deine Angaben</legend>
      <div class="form-row">
        <label>Vorname * <input type="text" name="p${i}_first" required autocomplete="given-name"></label>
        <label>Nachname * <input type="text" name="p${i}_last" required autocomplete="family-name"></label>
      </div>
      <div class="form-row">
        <label>E-Mail * <input type="email" name="p${i}_email" required autocomplete="email"></label>
        <label>Telefon * <input type="tel" name="p${i}_phone" required placeholder="+43 660 1234567" autocomplete="tel"></label>
      </div>
    `;
    container.appendChild(fs);
  }
}

function updateOrderSummary() {
  const price = selectedSlot?.workshop ? parseInt(selectedSlot.workshop.price_eur) || 50 : 50;
  const el = document.getElementById("summary-total");
  if (el) el.textContent = `${price} €`;
}

async function handleSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');
  const checkboxError = document.getElementById("checkbox-error");

  if (checkboxError) checkboxError.style.display = "none";
  btn.disabled = true;
  btn.textContent = "Wird gesendet...";

  try {
    const slotId = formData.get("slot_id");
    const workshopId = formData.get("workshop_id");
    const first = (formData.get("p0_first") || "").trim();
    const last = (formData.get("p0_last") || "").trim();
    const email = (formData.get("p0_email") || "").trim();
    const phone = (formData.get("p0_phone") || "").trim();

    if (!slotId || !workshopId || !first || !last || !email || !phone) throw new Error("Bitte alle Felder (Vorname, Nachname, E-Mail, Telefon) ausfüllen.");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) throw new Error("Bitte gültige E-Mail eingeben.");

    const contactEmail = email;
    const participants = [{ first_name: first, last_name: last, email, phone }];
    const voucherCode = String(formData.get("voucher_code") || "").trim();

    const agb = document.getElementById("agb_accepted")?.checked;
    const privacy = document.getElementById("privacy_accepted")?.checked;
    const fagg = document.getElementById("fagg_consent")?.checked;
    if (!agb || !privacy || !fagg) {
      throw new Error("Bitte alle rechtlichen Zustimmungen bestätigen.");
    }

    const payload = {
      slot_id: slotId,
      workshop_id: workshopId,
      contact_email: contactEmail,
      participants_count: 1,
      participants,
      voucher_code: voucherCode,
      agb_accepted: true,
      privacy_accepted: true,
      fagg_consent: true
    };

    const payloadBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const url = `${CONFIG.SCRIPT_BASE}?action=book&data=${encodeURIComponent(payloadBase64)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    clearTimeout(timeout);

    const result = await response.json();

    if (result.success || result.ok) {
      showSuccess(result.booking_id, slotId, contactEmail);
    } else {
      throw new Error(result.error || result.message || "Buchung fehlgeschlagen.");
    }
  } catch (err) {
    showMessage(err.message, "error");
    btn.disabled = false;
    btn.textContent = "Jetzt buchen";
  }
}

function showSuccess(bookingId, slotId, email) {
  const formSection = document.querySelector(".booking-form-section");
  if (formSection) formSection.style.display = "none";
  const success = document.getElementById("success-section");
  if (success) {
    success.style.display = "block";
    document.getElementById("success-id").textContent = bookingId || "–";
    document.getElementById("success-date").textContent = formatDateLong(slotId);
    document.getElementById("success-email").textContent = email;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ══════════════════════════════════════════════════════════════════════════════
// MITTAG – STARTSEITE
// ══════════════════════════════════════════════════════════════════════════════

async function fetchMittagSlotsToday() {
  try {
    const res = await fetch(CONFIG.SCRIPT_BASE + "?action=mittag_slots_today");
    return res.json();
  } catch (e) {
    console.warn("Mittag API:", e.message);
    return { ok: false };
  }
}

function selectMittagSlot(slotTime, date) {
  const params = new URLSearchParams({ slot_time: slotTime, date: date || new Date().toISOString().slice(0, 10) });
  window.location.href = "buchen.html?" + params.toString();
}

window.selectMittagSlot = selectMittagSlot;

function initMittagBookingPage() {
  const slotTime = getUrlParam("slot_time");
  const date = getUrlParam("date") || new Date().toISOString().slice(0, 10);

  if (!slotTime) {
    showNoSlotError("Bitte wählen Sie einen Zeitslot.");
    return;
  }

  const formSection = document.querySelector(".booking-form-section");
  const slotInfoCard = document.getElementById("slot-info-card");
  const participantsSection = document.querySelector(".participants-data-section");
  const voucherSection = document.querySelector(".voucher-section");

  if (slotInfoCard) {
    slotInfoCard.innerHTML = `
      <div class="slot-info-icon">🕐</div>
      <div class="slot-info-header">Gewählter Zeitslot</div>
      <div class="slot-info-date">${formatDateLong(date)}</div>
      <div class="slot-info-time"><span class="time-label">Uhrzeit:</span> <span class="time-value">${slotTime} Uhr</span></div>
      <a href="index.html" class="slot-change-link">← Anderen Slot wählen</a>
    `;
  }
  if (participantsSection) {
    const pInner = participantsSection.querySelector(".section-header");
    if (pInner) pInner.innerHTML = '<span class="section-icon">👤</span><h3>Ihre Angaben</h3>';
  }
  if (voucherSection) voucherSection.style.display = "none";

  const participantsDiv = document.getElementById("participants");
  if (participantsDiv) {
    participantsDiv.innerHTML = `
      <div class="form-row">
        <label>Vorname * <input type="text" name="first_name" id="first_name" required autocomplete="given-name"></label>
        <label>Nachname * <input type="text" name="last_name" id="last_name" required autocomplete="family-name"></label>
      </div>
      <div class="form-row">
        <label>Telefonnummer * <input type="tel" name="phone" id="phone" required placeholder="+43 660 1234567" autocomplete="tel"></label>
      </div>
    `;
  }

  const orderSummary = document.querySelector(".order-summary");
  if (orderSummary) {
    orderSummary.innerHTML = `
      <h3>📋 Buchungsübersicht</h3>
      <div class="order-summary-row">
        <span class="order-label">Datum:</span>
        <span class="order-value">${formatDateLong(date)}</span>
      </div>
      <div class="order-summary-row">
        <span class="order-label">Zeitslot:</span>
        <span class="order-value">${slotTime} Uhr</span>
      </div>
      <div class="order-summary-row">
        <span class="order-label">Menü:</span>
        <span class="order-value">Mittagsmenü (Preis wird bei Buchung berechnet)</span>
      </div>
    `;
  }

  const legalCheckboxes = document.querySelector(".legal-checkboxes");
  if (legalCheckboxes) {
    legalCheckboxes.innerHTML = `
      <h4>Rechtliche Zustimmungen</h4>
      <label class="checkbox-item">
        <input type="checkbox" class="checkbox-square" name="agb_accepted" id="agb_accepted" required>
        <span>Ich akzeptiere die <a href="agb.html" target="_blank">AGB</a>. *</span>
      </label>
      <label class="checkbox-item">
        <input type="checkbox" class="checkbox-square" name="privacy_accepted" id="privacy_accepted" required>
        <span>Ich habe die <a href="privacy.html" target="_blank">Datenschutzerklärung</a> zur Kenntnis genommen. *</span>
      </label>
      <p class="checkbox-hint">* Pflichtfeld</p>
    `;
  }

  document.getElementById("slot_id")?.remove();
  document.getElementById("workshop_id")?.remove();
}

async function handleMittagSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const first = (form.querySelector('[name="first_name"]')?.value || "").trim();
  const last = (form.querySelector('[name="last_name"]')?.value || "").trim();
  const phone = (form.querySelector('[name="phone"]')?.value || "").trim();
  const agb = form.querySelector('#agb_accepted')?.checked;
  const privacy = form.querySelector('#privacy_accepted')?.checked;

  if (!first || !last || !phone) {
    showMessage("Bitte alle Felder ausfüllen.", "error");
    return;
  }
  if (!agb || !privacy) {
    showMessage("Bitte AGB und Datenschutz bestätigen.", "error");
    return;
  }

  const slotTime = getUrlParam("slot_time");
  const date = getUrlParam("date") || new Date().toISOString().slice(0, 10);

  btn.disabled = true;
  btn.textContent = "Wird gesendet...";

  try {
    const payload = {
      first_name: first,
      last_name: last,
      phone,
      slot_time: slotTime,
      date,
      agb_accepted: true
    };
    const payloadBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const url = CONFIG.SCRIPT_BASE + "?action=mittag_book&data=" + encodeURIComponent(payloadBase64);

    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const result = await res.json();

    if (result.success || result.ok) {
      const success = document.getElementById("success-section");
      if (success) {
        success.style.display = "block";
        document.getElementById("success-id").textContent = result.booking_id || "–";
        document.getElementById("success-date").textContent = formatDateLong(date) + ", " + slotTime + " Uhr";
        document.getElementById("success-email").textContent = phone;
      }
      document.querySelector(".booking-form-section").style.display = "none";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      throw new Error(result.error || result.message || "Buchung fehlgeschlagen.");
    }
  } catch (err) {
    showMessage(err.message, "error");
  }
  btn.disabled = false;
  btn.textContent = "Jetzt buchen";
}

async function initMittag() {
  const loading = document.getElementById("mittag-loading");
  const noMenu = document.getElementById("mittag-no-menu");
  const content = document.getElementById("mittag-content");

  if (!loading || !noMenu || !content) return;

  const data = await fetchMittagSlotsToday();
  loading.classList.add("hidden");

  if (!data.ok || !data.menu) {
    noMenu.classList.remove("hidden");
    return;
  }

  content.classList.remove("hidden");
  document.getElementById("mittag-vorspeise").textContent = data.menu.vorspeise || "–";
  document.getElementById("mittag-hauptspeise").textContent = data.menu.hauptspeise || "–";
  document.getElementById("mittag-preis").textContent = (data.menu.preis || 15) + " €";

  const badge = document.getElementById("mittag-rabatt-badge");
  if (data.menu.rabatt_aktiv) {
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }

  const slotsContainer = document.getElementById("mittag-slots");
  const slots = data.slots || [];
  const date = data.date || "";

  slotsContainer.innerHTML = slots.map(s => {
    const available = s.available && s.free > 0;
    const cls = available ? "mittag-slot" : "mittag-slot full";
    const label = available
      ? s.time + " Uhr (" + s.free + " frei)"
      : s.time + " – Ausgebucht";
    const attr = available
      ? `onclick="selectMittagSlot('${s.time}','${date}')" style="cursor:pointer;"`
      : 'style="cursor:not-allowed; opacity:0.7;"';
    return `<div class="${cls}" ${attr}>${label}</div>`;
  }).join("");
}

// ══════════════════════════════════════════════════════════════════════════════
// INITIALISIERUNG
// ══════════════════════════════════════════════════════════════════════════════

async function init() {
  const isBookingPage = window.location.pathname.includes("buchen.html");
  const isMittagIndex = !isBookingPage && document.getElementById("mittag-content");
  const slotTime = getUrlParam("slot_time");
  const workshopId = getUrlParam("workshop_id");

  if (isBookingPage && slotTime) {
    const form = document.getElementById("booking-form");
    if (form) form.addEventListener("submit", handleMittagSubmit);
    const newBtn = document.getElementById("new-booking");
    if (newBtn) newBtn.addEventListener("click", () => { window.location.href = "index.html"; });
    initMittagBookingPage();
  } else if (isBookingPage && workshopId) {
    const form = document.getElementById("booking-form");
    if (form) form.addEventListener("submit", handleSubmit);
    const newBtn = document.getElementById("new-booking");
    if (newBtn) newBtn.addEventListener("click", () => { window.location.href = "index.html"; });
    initBookingPage();
  } else if (isMittagIndex) {
    initMittag();
  } else if (isBookingPage) {
    showNoSlotError("Bitte wählen Sie zuerst einen Zeitslot auf der Startseite.");
  } else {
    await loadAllWorkshopsAndSlots();
  }
}

document.addEventListener("DOMContentLoaded", init);
