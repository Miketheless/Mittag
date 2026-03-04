/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MITTAGSMENÜ BUCHUNGSSYSTEM – Wirtshaus Metzenhof
 * mittag.metzenhof.at
 * 
 * Mittag: MittagMenu, fixe Slots 11:30/12:00/12:30/13:00, max 40/Slot
 * Rabatt: vor 10:00 → 12€, ab 10:00 → 15€ (serverseitig validiert)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const SPREADSHEET_ID = "1bIdv2dg2iALcM5L2DmzH7gPXuI4z6V8fJJPwbXHXS8Q";

const SHEET_BOOKINGS = "Bookings";
const SHEET_PARTICIPANTS = "Participants";
const SHEET_SETTINGS = "Settings";
const SHEET_MITTAG_MENU = "MittagMenu";

const MITTAG_WEEKDAYS = [3, 4, 5];
const MITTAG_SLOTS = ["11:30", "12:00", "12:30", "13:00"];
const MITTAG_MAX_PER_SLOT = 40;
const MITTAG_PREIS_BASIS = 15;
const MITTAG_PREIS_RABATT = 12;

// ══════════════════════════════════════════════════════════════════════════════
// HILFSFUNKTIONEN
// ══════════════════════════════════════════════════════════════════════════════

function getSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (_) {}
  if (!SPREADSHEET_ID || SPREADSHEET_ID === "DEINE_SPREADSHEET_ID") {
    throw new Error("SPREADSHEET_ID nicht gesetzt!");
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
}

function getSheet(name) {
  return getSpreadsheet().getSheetByName(name);
}

function getSetting(key) {
  const sheet = getSheet(SHEET_SETTINGS);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}

function generateBookingId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "MT-";
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function generateCancelToken() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function notifyN8nWebhook(event, payload) {
  const url = getSetting("N8N_WEBHOOK_URL");
  if (!url || typeof url !== "string" || !url.trim()) return;
  try {
    UrlFetchApp.fetch(url.trim(), {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ event, ...payload }),
      muteHttpExceptions: true
    });
  } catch (e) {
    console.warn("n8n Webhook Fehler:", e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// API ROUTER
// ══════════════════════════════════════════════════════════════════════════════

function doGet(e) {
  if (!e || !e.parameter) {
    return jsonResponse({ ok: false, message: "Keine Parameter" });
  }
  const action = e.parameter.action;
  
  switch (action) {
    case "mittag_menu_today": return handleMittagMenuToday();
    case "mittag_slots_today": return handleMittagSlotsToday();
    case "mittag_book": return handleMittagBookViaGet(e.parameter.data);
    case "cancel": return handleCancel(e.parameter.token);
    case "mittag_admin_menu": return handleMittagAdminMenu(e.parameter);
    case "mittag_admin_menu_month": return handleMittagAdminMenuMonth(e.parameter);
    case "mittag_admin_save_menu": return handleMittagAdminSaveMenu(e.parameter);
    case "mittag_admin_overview": return handleMittagAdminOverview(e.parameter);
    case "mittag_api_menu": return handleMittagApiMenu(e.parameter);
    case "mittag_api_slots_count": return handleMittagApiSlotsCount(e.parameter);
    case "mittag_api_bookings_export": return handleMittagApiBookingsExport(e.parameter);
    default: return jsonResponse({ ok: false, message: "Unbekannte Aktion" });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MITTAG – ÖFFENTLICHE API
// ══════════════════════════════════════════════════════════════════════════════

function isMittagDay(now) {
  const d = now || new Date();
  return MITTAG_WEEKDAYS.indexOf(d.getDay()) >= 0;
}

function isRabattGueltig(now) {
  const d = now || new Date();
  const h = d.getHours();
  const m = d.getMinutes();
  return h < 10 || (h === 10 && m === 0);
}

function mittagSlotId(dateId, timeStr) {
  const t = (timeStr || "11:30").replace(":", "");
  return "mittag_" + (dateId || "").replace(/-/g, "") + "_" + t;
}

function getMittagMenuForDate(dateId) {
  const raw = getMittagMenuRawForDate(dateId);
  return raw && raw.aktiv ? raw : null;
}

function getMittagMenuRawForDate(dateId) {
  const sheet = getSheet(SHEET_MITTAG_MENU);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const data = sheet.getDataRange().getValues();
  const d = String(dateId).trim().split("T")[0];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowDate = String(row[0] || "").trim();
    if (rowDate.split("T")[0] === d) {
      const aktiv = row[6] === true || row[6] === "TRUE" || row[6] === "x" || row[6] === 1;
      return {
        date: rowDate.split("T")[0],
        weekday: parseInt(row[1]) || 3,
        vorspeise: String(row[2] || "").trim(),
        hauptspeise: String(row[3] || "").trim(),
        preis_basis: parseInt(row[4]) || MITTAG_PREIS_BASIS,
        preis_rabatt: parseInt(row[5]) || MITTAG_PREIS_RABATT,
        aktiv
      };
    }
  }
  return null;
}

function getMittagBookingsCountBySlot(dateId) {
  const sheet = getSheet(SHEET_BOOKINGS);
  if (!sheet || sheet.getLastRow() < 2) return {};
  const data = sheet.getDataRange().getValues();
  const prefix = "mittag_" + String(dateId).replace(/-/g, "");
  const counts = { "11:30": 0, "12:00": 0, "12:30": 0, "13:00": 0 };
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[6] === "CANCELLED") continue;
    const slotId = String(row[2] || "");
    if (!slotId.startsWith(prefix)) continue;
    const m = slotId.match(/_(\d{4})$/);
    if (m) {
      const t = m[1].replace(/(\d{2})(\d{2})/, "$1:$2");
      if (counts[t] !== undefined) counts[t]++;
    }
  }
  return counts;
}

function handleMittagMenuToday() {
  const now = new Date();
  const dateId = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
  if (!isMittagDay(now)) {
    return jsonResponse({ ok: true, menu: null, message: "Heute kein Mittagsmenü" });
  }
  const menu = getMittagMenuForDate(dateId);
  if (!menu) {
    return jsonResponse({ ok: true, menu: null, message: "Kein aktives Menü" });
  }
  const rabatt = isRabattGueltig(now);
  const preis = rabatt ? menu.preis_rabatt : menu.preis_basis;
  return jsonResponse({
    ok: true,
    menu: {
      date: menu.date,
      vorspeise: menu.vorspeise,
      hauptspeise: menu.hauptspeise,
      preis: preis,
      preis_basis: menu.preis_basis,
      preis_rabatt: menu.preis_rabatt,
      rabatt_aktiv: rabatt
    }
  });
}

function handleMittagSlotsToday() {
  const now = new Date();
  const dateId = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
  if (!isMittagDay(now)) {
    return jsonResponse({ ok: true, date: dateId, slots: [], message: "Heute kein Mittagsmenü" });
  }
  const menu = getMittagMenuForDate(dateId);
  if (!menu) {
    return jsonResponse({ ok: true, date: dateId, slots: [], message: "Kein aktives Menü" });
  }
  const counts = getMittagBookingsCountBySlot(dateId);
  const slots = MITTAG_SLOTS.map(t => {
    const booked = counts[t] || 0;
    const free = Math.max(0, MITTAG_MAX_PER_SLOT - booked);
    return {
      time: t,
      slot_id: mittagSlotId(dateId, t),
      booked,
      free,
      max: MITTAG_MAX_PER_SLOT,
      available: free > 0
    };
  });
  const rabatt = isRabattGueltig(now);
  const preis = rabatt ? menu.preis_rabatt : menu.preis_basis;
  return jsonResponse({
    ok: true,
    date: dateId,
    menu: { vorspeise: menu.vorspeise, hauptspeise: menu.hauptspeise, preis, rabatt_aktiv: rabatt },
    slots
  });
}

function handleMittagBookViaGet(base64Data) {
  try {
    if (!base64Data) return jsonResponse({ ok: false, success: false, error: "Keine Buchungsdaten" });
    const jsonString = Utilities.newBlob(Utilities.base64Decode(base64Data)).getDataAsString("UTF-8");
    const payload = JSON.parse(jsonString);
    return handleMittagBook(payload);
  } catch (error) {
    return jsonResponse({ ok: false, success: false, error: "Fehler: " + error.message });
  }
}

function handleMittagBook(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const first = (payload.first_name || "").toString().trim();
    const last = (payload.last_name || "").toString().trim();
    const phone = (payload.phone || "").toString().trim();
    const slotTime = (payload.slot_time || "").toString().trim();
    const dateId = (payload.date || "").toString().trim().split("T")[0];

    if (!first || !last || !phone) {
      return jsonResponse({ ok: false, success: false, error: "Vorname, Nachname und Telefon erforderlich" });
    }
    if (!payload.agb_accepted) {
      return jsonResponse({ ok: false, success: false, error: "AGB müssen akzeptiert werden" });
    }
    if (!MITTAG_SLOTS.includes(slotTime)) {
      return jsonResponse({ ok: false, success: false, error: "Ungültiger Slot" });
    }

    const now = new Date();
    const todayId = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
    if (dateId !== todayId) {
      return jsonResponse({ ok: false, success: false, error: "Buchung nur für heute möglich" });
    }
    if (!isMittagDay(now)) {
      return jsonResponse({ ok: false, success: false, error: "Heute kein Mittagsmenü" });
    }

    const menu = getMittagMenuForDate(dateId);
    if (!menu) {
      return jsonResponse({ ok: false, success: false, error: "Kein aktives Menü für heute" });
    }

    const counts = getMittagBookingsCountBySlot(dateId);
    const booked = counts[slotTime] || 0;
    if (booked >= MITTAG_MAX_PER_SLOT) {
      return jsonResponse({ ok: false, success: false, error: "Slot ausgebucht" });
    }

    const rabatt = isRabattGueltig(now);
    const preis = rabatt ? menu.preis_rabatt : menu.preis_basis;

    const slotId = mittagSlotId(dateId, slotTime);
    const bookingId = generateBookingId();
    const cancelToken = generateCancelToken();

    const bookingsSheet = getSheet(SHEET_BOOKINGS);
    ensureBookingsColumns(bookingsSheet);
    ensureMittagBookingsColumns(bookingsSheet);
    bookingsSheet.appendRow([
      bookingId, new Date().toISOString(), slotId, "mittag", phone, 1, "CONFIRMED",
      cancelToken, "", false, "", false, "", preis, rabatt
    ]);

    const participantsSheet = getSheet(SHEET_PARTICIPANTS);
    participantsSheet.appendRow([bookingId, 1, first, last, "", phone]);

    notifyN8nWebhook("mittag_booking", {
      booking_id: bookingId,
      first_name: first,
      last_name: last,
      phone,
      slot_time: slotTime,
      date: dateId,
      price: preis,
      rabatt,
      timestamp: new Date().toISOString()
    });

    return jsonResponse({
      ok: true,
      success: true,
      booking_id: bookingId,
      message: "Buchung erfolgreich",
      price: preis
    });
  } catch (error) {
    console.error("Mittag Buchung:", error);
    return jsonResponse({ ok: false, success: false, error: "Fehler: " + error.message });
  } finally {
    lock.releaseLock();
  }
}

function ensureBookingsColumns(sheet) {
  if (!sheet || sheet.getLastRow() < 1) return;
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (header.length >= 13) return;
  const labels = ["rng", "RNG Bezahlt", "Erschienen", "Gutscheinnummer"];
  for (let i = 0; i < labels.length; i++) {
    sheet.getRange(1, 10 + i).setValue(labels[i]);
  }
}

function ensureMittagBookingsColumns(sheet) {
  if (!sheet || sheet.getLastRow() < 1) return;
  const lastCol = sheet.getLastColumn();
  if (lastCol < 14) sheet.getRange(1, 14).setValue("price_eur");
  if (lastCol < 15) sheet.getRange(1, 15).setValue("rabatt_applied");
}

// ══════════════════════════════════════════════════════════════════════════════
// STORNO (cancel.html)
// ══════════════════════════════════════════════════════════════════════════════

function handleCancel(token) {
  if (!token) return jsonResponse({ ok: false, message: "Kein Token" });
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    const bookingsSheet = getSheet(SHEET_BOOKINGS);
    const bookingsData = bookingsSheet.getDataRange().getValues();
    
    let bookingRowIndex = -1;
    let bookingData = null;
    
    for (let i = 1; i < bookingsData.length; i++) {
      if (bookingsData[i][7] === token) {
        bookingRowIndex = i + 1;
        const slotId = String(bookingsData[i][2] || "");
        const m = slotId.match(/mittag_(\d{8})_(\d{4})/);
        bookingData = {
          booking_id: bookingsData[i][0],
          slot_id: slotId,
          workshop_id: bookingsData[i][3],
          participants_count: 1,
          status: bookingsData[i][6]
        };
        if (m) {
          bookingData.date = m[1].replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
          bookingData.slot_time = m[2].replace(/(\d{2})(\d{2})/, "$1:$2");
        }
        break;
      }
    }
    
    if (!bookingData) return jsonResponse({ ok: false, message: "Buchung nicht gefunden" });
    
    if (bookingData.status === "CANCELLED") {
      return jsonResponse({ ok: true, already_cancelled: true, booking_id: bookingData.booking_id, message: "Bereits storniert" });
    }
    
    const cancelledAt = new Date().toISOString();
    bookingsSheet.getRange(bookingRowIndex, 7).setValue("CANCELLED");
    bookingsSheet.getRange(bookingRowIndex, 9).setValue(cancelledAt);
    
    notifyN8nWebhook("mittag_cancellation", {
      booking_id: bookingData.booking_id,
      slot_time: bookingData.slot_time || "",
      date: bookingData.date || "",
      timestamp: cancelledAt
    });
    
    return jsonResponse({ ok: true, booking_id: bookingData.booking_id, message: "Buchung storniert" });
    
  } catch (error) {
    return jsonResponse({ ok: false, message: "Fehler" });
  } finally {
    lock.releaseLock();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MITTAG ADMIN
// ══════════════════════════════════════════════════════════════════════════════

function handleMittagAdminMenu(params) {
  if (!params.admin_key || params.admin_key !== getSetting("ADMIN_KEY")) {
    return jsonResponse({ ok: false, message: "Ungültiger Admin-Schlüssel" });
  }
  const dateId = (params.date || "").toString().trim().split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateId)) {
    return jsonResponse({ ok: false, message: "Datum erforderlich (YYYY-MM-DD)" });
  }
  const menu = getMittagMenuRawForDate(dateId);
  const d = new Date(dateId);
  const rowData = menu || {
    date: dateId,
    weekday: d.getDay(),
    vorspeise: "",
    hauptspeise: "",
    preis_basis: MITTAG_PREIS_BASIS,
    preis_rabatt: MITTAG_PREIS_RABATT,
    aktiv: false
  };
  return jsonResponse({ ok: true, menu: rowData });
}

function handleMittagAdminMenuMonth(params) {
  if (!params.admin_key || params.admin_key !== getSetting("ADMIN_KEY")) {
    return jsonResponse({ ok: false, message: "Ungültiger Admin-Schlüssel" });
  }
  const year = parseInt(params.year, 10);
  const month = parseInt(params.month, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return jsonResponse({ ok: false, message: "Jahr und Monat erforderlich (year, month)" });
  }
  const sheet = getSheet(SHEET_MITTAG_MENU);
  const menusByDate = {};
  if (sheet && sheet.getLastRow() >= 2) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowDate = String(row[0] || "").trim().split("T")[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rowDate)) continue;
      const [y, m] = rowDate.split("-").map(Number);
      if (y === year && m === month) {
        const aktiv = row[6] === true || row[6] === "TRUE" || row[6] === "x" || row[6] === 1;
        menusByDate[rowDate] = {
          date: rowDate,
          weekday: parseInt(row[1]) || 3,
          vorspeise: String(row[2] || "").trim(),
          hauptspeise: String(row[3] || "").trim(),
          preis_basis: parseInt(row[4]) || MITTAG_PREIS_BASIS,
          preis_rabatt: parseInt(row[5]) || MITTAG_PREIS_RABATT,
          aktiv
        };
      }
    }
  }
  const menus = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    const day = d.getDay();
    if (MITTAG_WEEKDAYS.indexOf(day) >= 0) {
      const dateId = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
      menus.push(menusByDate[dateId] || {
        date: dateId,
        weekday: day,
        vorspeise: "",
        hauptspeise: "",
        preis_basis: MITTAG_PREIS_BASIS,
        preis_rabatt: MITTAG_PREIS_RABATT,
        aktiv: false
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return jsonResponse({ ok: true, menus });
}

function handleMittagAdminSaveMenu(params) {
  if (!params.admin_key || params.admin_key !== getSetting("ADMIN_KEY")) {
    return jsonResponse({ ok: false, message: "Ungültiger Admin-Schlüssel" });
  }
  const dateId = (params.date || "").toString().trim().split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateId)) {
    return jsonResponse({ ok: false, message: "Datum erforderlich" });
  }
  const sheet = getSheet(SHEET_MITTAG_MENU);
  if (!sheet) return jsonResponse({ ok: false, message: "MittagMenu-Sheet nicht gefunden" });

  const vorspeise = (params.vorspeise || "").toString().trim();
  const hauptspeise = (params.hauptspeise || "").toString().trim();
  const preis_basis = parseInt(params.preis_basis) || MITTAG_PREIS_BASIS;
  const preis_rabatt = parseInt(params.preis_rabatt) || MITTAG_PREIS_RABATT;
  const aktiv = params.aktiv === "true" || params.aktiv === true || params.aktiv === "1";

  const d = new Date(dateId);
  const weekday = d.getDay();

  let existingRow = -1;
  if (sheet.getLastRow() >= 2) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).split("T")[0] === dateId) {
        existingRow = i + 1;
        break;
      }
    }
  }

  if (existingRow > 0) {
    sheet.getRange(existingRow, 2, existingRow, 7).setValues([[weekday, vorspeise, hauptspeise, preis_basis, preis_rabatt, aktiv]]);
  } else {
    sheet.appendRow([dateId, weekday, vorspeise, hauptspeise, preis_basis, preis_rabatt, aktiv]);
  }
  return jsonResponse({ ok: true, message: "Gespeichert" });
}

function handleMittagAdminOverview(params) {
  if (!params.admin_key || params.admin_key !== getSetting("ADMIN_KEY")) {
    return jsonResponse({ ok: false, message: "Ungültiger Admin-Schlüssel" });
  }
  const dateId = (params.date || "").toString().trim().split("T")[0] || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

  const bookingsSheet = getSheet(SHEET_BOOKINGS);
  ensureMittagBookingsColumns(bookingsSheet);

  const rows = [];
  const data = bookingsSheet.getDataRange().getValues();
  const prefix = "mittag_" + dateId.replace(/-/g, "");
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[6] === "CANCELLED") continue;
    if (!String(row[2]).startsWith(prefix)) continue;
    const m = String(row[2]).match(/_(\d{4})$/);
    const slotTime = m ? m[1].replace(/(\d{2})(\d{2})/, "$1:$2") : "";
    const price = parseFloat(row[13]) || 15;
    const rabatt = row[14] === true || row[14] === "TRUE";
    rows.push({ slot_time: slotTime, price, rabatt });
  }

  const slotStats = MITTAG_SLOTS.map(t => {
    const items = rows.filter(r => r.slot_time === t);
    const anzahl = items.length;
    const umsatz = items.reduce((s, r) => s + r.price, 0);
    const rabattCount = items.filter(r => r.rabatt).length;
    return { slot: t, anzahl, umsatz, rabatt_count: rabattCount };
  });

  const gesamt = {
    menues: slotStats.reduce((s, x) => s + x.anzahl, 0),
    umsatz: slotStats.reduce((s, x) => s + x.umsatz, 0),
    rabatt_gesamt: slotStats.reduce((s, x) => s + x.rabatt_count, 0)
  };

  return jsonResponse({ ok: true, date: dateId, slots: slotStats, gesamt });
}

// ══════════════════════════════════════════════════════════════════════════════
// MITTAG API (n8n)
// ══════════════════════════════════════════════════════════════════════════════

function handleMittagApiMenu(params) {
  const dateId = (params.date || "").toString().trim().split("T")[0] || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const menu = getMittagMenuForDate(dateId);
  return jsonResponse({ ok: true, date: dateId, menu: menu || null });
}

function handleMittagApiSlotsCount(params) {
  const dateId = (params.date || "").toString().trim().split("T")[0] || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const counts = getMittagBookingsCountBySlot(dateId);
  return jsonResponse({ ok: true, date: dateId, slots: counts });
}

function handleMittagApiBookingsExport(params) {
  const dateId = (params.date || "").toString().trim().split("T")[0] || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const adminKey = params.admin_key || params.key;
  if (!adminKey || adminKey !== getSetting("ADMIN_KEY")) {
    return jsonResponse({ ok: false, message: "admin_key erforderlich" });
  }
  const bookingsSheet = getSheet(SHEET_BOOKINGS);
  const participantsSheet = getSheet(SHEET_PARTICIPANTS);
  ensureMittagBookingsColumns(bookingsSheet);

  const data = bookingsSheet.getDataRange().getValues();
  const prefix = "mittag_" + dateId.replace(/-/g, "");
  const participantsData = participantsSheet.getDataRange().getValues();
  const byBooking = {};
  for (let i = 1; i < participantsData.length; i++) {
    const bid = participantsData[i][0];
    if (!byBooking[bid]) byBooking[bid] = [];
    byBooking[bid].push(participantsData[i]);
  }

  const bookings = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[6] === "CANCELLED") continue;
    if (!String(row[2]).startsWith(prefix)) continue;
    const m = String(row[2]).match(/_(\d{4})$/);
    const slotTime = m ? m[1].replace(/(\d{2})(\d{2})/, "$1:$2") : "";
    const p = (byBooking[row[0]] || [])[0];
    bookings.push({
      booking_id: row[0],
      timestamp: row[1],
      slot_time: slotTime,
      first_name: p ? p[2] : "",
      last_name: p ? p[3] : "",
      phone: p ? p[5] : "",
      price: parseFloat(row[13]) || 15,
      rabatt: row[14] === true || row[14] === "TRUE"
    });
  }
  return jsonResponse({ ok: true, date: dateId, bookings });
}

// ══════════════════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════════════════

function initSheets() {
  const ss = getSpreadsheet();
  
  let bo = ss.getSheetByName(SHEET_BOOKINGS);
  if (!bo) { bo = ss.insertSheet(SHEET_BOOKINGS); }
  if (bo.getLastRow() === 0) {
    bo.appendRow(["booking_id", "timestamp", "slot_id", "workshop_id", "contact_email", "participants_count", "status", "cancel_token", "cancelled_at", "rng", "rng_bezahlt", "erschienen", "Gutscheinnummer"]);
  }
  
  let pa = ss.getSheetByName(SHEET_PARTICIPANTS);
  if (!pa) { pa = ss.insertSheet(SHEET_PARTICIPANTS); }
  if (pa.getLastRow() === 0) {
    pa.appendRow(["booking_id", "idx", "first_name", "last_name", "email", "phone"]);
  }
  
  let mm = ss.getSheetByName(SHEET_MITTAG_MENU);
  if (!mm) { mm = ss.insertSheet(SHEET_MITTAG_MENU); }
  if (mm.getLastRow() === 0) {
    mm.appendRow(["date", "weekday", "vorspeise", "hauptspeise", "preis_basis", "preis_rabatt", "aktiv"]);
  }

  let se = ss.getSheetByName(SHEET_SETTINGS);
  if (!se) { se = ss.insertSheet(SHEET_SETTINGS); }
  if (se.getLastRow() === 0) {
    se.appendRow(["key", "value"]);
    se.appendRow(["ADMIN_EMAIL", "info@metzenhof.at"]);
    se.appendRow(["MAIL_FROM_NAME", "Wirtshaus Metzenhof"]);
    se.appendRow(["ADMIN_KEY", "CHANGE_THIS_SECRET_KEY"]);
    se.appendRow(["PUBLIC_BASE_URL", "https://mittag.metzenhof.at"]);
  }
  
  console.log("Sheets initialisiert.");
}
