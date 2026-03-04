# Mittagsmenü-Buchungsplattform – Wirtshaus Metzenhof

**Domain:** mittag.metzenhof.at

---

# Schritt-für-Schritt-Anleitung

Alles, was du tun musst, um die Plattform in Betrieb zu nehmen.

---

## Schritt 1: Google Sheet anlegen

1. Gehe zu **https://sheets.google.com**
2. Klicke auf **+ Leer** → neues Tabellenblatt erstellen
3. Gib dem Sheet einen Namen, z.B. **„Mittag Metzenhof“**
4. **SPREADSHEET_ID** kopieren:
   - URL: `https://docs.google.com/spreadsheets/d/1abc123XYZ.../edit`
   - ID = der Teil zwischen `/d/` und `/edit`
   - Beispiel: `1NkaviS-fPq_A04HntatthchUYgjTto04Adicd-LvmBg`
5. ID notieren – wird in Schritt 2 benötigt

---

## Schritt 2: Apps Script Backend einrichten

1. Gehe zu **https://script.google.com**
2. **+ Neues Projekt** → Script-Editor öffnet sich
3. Den Beispielcode löschen (Strg+A, Entf)
4. Datei **backend.gs** aus diesem Projekt öffnen
5. Kompletten Inhalt kopieren und in den Apps-Script-Editor einfügen
6. Zeile suchen: `const SPREADSHEET_ID = "..."`
7. **SPREADSHEET_ID** durch deine ID aus Schritt 1 ersetzen (Anführungszeichen behalten)
8. Projekt speichern (Strg+S)

---

## Schritt 3: Sheets initialisieren

1. Im Script-Editor oben: Dropdown mit Funktionsnamen
2. Funktion **initSheets** auswählen
3. **Ausführen** (▶) klicken
4. Beim ersten Mal: **Berechtigungen prüfen** → Google-Account wählen → **Zulassen**
5. Warten bis „Ausführung abgeschlossen“
6. Google Sheet öffnen → Tabs sollten da sein: **MittagMenu**, Bookings, Participants, Settings, etc.

---

## Schritt 4: Settings im Google Sheet

1. Tab **Settings** öffnen
2. Folgende Werte eintragen:

| key | value |
|-----|-------|
| ADMIN_KEY | Ein geheimer Schlüssel, den nur du kennst (z.B. `MeinSicheresPasswort2026`) |
| ADMIN_EMAIL | Deine E-Mail (z.B. `info@metzenhof.at`) |
| MAIL_FROM_NAME | Absender (z.B. `Wirtshaus Metzenhof`) |
| PUBLIC_BASE_URL | **Noch leer** – wird in Schritt 8 eingetragen |
| N8N_WEBHOOK_URL | Optional: n8n-Webhook für Automatisierungen |

3. Sheet speichern (Strg+S)
4. **ADMIN_KEY** notieren – brauchst du für den Admin-Login!

---

## Schritt 5: Web-App bereitstellen

1. Im Apps-Script-Editor oben rechts: **Bereitstellen**
2. **Neue Bereitstellung** → Zahnrad → **Web-App** wählen
3. Einstellungen:
   - **Ausführen als:** Ich
   - **Zugriff:** **Jeder** (wichtig!)
4. **Bereitstellen** klicken
5. Beim ersten Mal: nochmals **Autorisieren**
6. **Web-App-URL** erscheint (z.B. `https://script.google.com/macros/s/AKfycb.../exec`)
7. URL kopieren und notieren – wird in Schritt 6 benötigt

---

## Schritt 6: SCRIPT_BASE im Projekt eintragen

1. Projekt im Editor (Cursor/VS Code) öffnen
2. In diesen Dateien die **Web-App-URL** (aus Schritt 5) bei `SCRIPT_BASE` eintragen:
   - **app.js**
   - **admin/mittag-admin.js**
   - **cancel.html** (im `<script>`-Block)
3. Alle Dateien speichern

---

## Schritt 7: GitHub Repository & Pages

### 7a) Code auf GitHub hochladen

1. Gehe zu **https://github.com**
2. Neues Repository anlegen (oder bestehendes nutzen), z.B. **Mittag**
3. Lokal im Projektordner:
   ```bash
   git add .
   git commit -m "Mittagsmenü-Plattform"
   git push origin main
   ```

### 7b) GitHub Pages aktivieren

1. Im Repository: **Settings**
2. Links: **Pages**
3. Unter „Build and deployment“:
   - **Source:** Deploy from a branch
   - **Branch:** main
   - **Folder:** / (root)
4. **Save** klicken
5. 1–2 Minuten warten

### 7c) URL merken

- URL: `https://<dein-github-username>.github.io/<repo-name>/`
- Beispiel: `https://micha.github.io/Mittag/`

---

## Schritt 8: Custom Domain mittag.metzenhof.at

### 8a) PUBLIC_BASE_URL eintragen

1. Google Sheet → Tab **Settings**
2. Bei **PUBLIC_BASE_URL** die GitHub-Pages-URL eintragen (ohne `/` am Ende)
   - Z.B. `https://micha.github.io/Mittag`

### 8b) DNS für mittag.metzenhof.at

1. Bei deinem Domain-Anbieter (z.B. wo metzenhof.at verwaltet wird)
2. Einen **CNAME**-Eintrag anlegen:
   - **Name:** mittag (oder mittag.metzenhof.at, je nach Anbieter)
   - **Ziel:** `<dein-github-username>.github.io`
3. Änderung speichern – DNS kann 5–60 Min. dauern

### 8c) GitHub Pages Domain setzen

1. Im Repo: **Settings** → **Pages**
2. Unter „Custom domain“: `mittag.metzenhof.at` eintragen
3. **Save** klicken
4. Optional: **Enforce HTTPS** aktivieren

> Die Datei **CNAME** im Projekt enthält bereits `mittag.metzenhof.at` – wird beim Deploy automatisch verwendet.

---

## Schritt 9: Erste Menüs anlegen

1. Öffne **https://mittag.metzenhof.at/admin/**
2. Mit **ADMIN_KEY** (aus Schritt 4) anmelden
3. Tab **Menü bearbeiten**
4. Datum wählen (z.B. nächsten Mittwoch)
5. Vorspeise und Hauptspeise eintragen
6. **Aktivieren** anhaken
7. **Speichern** klicken

→ Ab jetzt erscheint das Menü an diesem Tag auf der Startseite.

---

## Schritt 10: Testen

1. **Startseite:** https://mittag.metzenhof.at  
   - An einem Mi/Do/Fr mit aktivem Menü solltest du das Menü und die Slots sehen
2. **Buchung:** Slot wählen → Formular ausfüllen → buchen
3. **Admin Übersicht:** https://mittag.metzenhof.at/admin/  
   - Tab „Tagesübersicht“ → Datum wählen → Buchungen pro Slot prüfen

---

## Übersicht der wichtigen URLs

| Seite | URL |
|-------|-----|
| Startseite | https://mittag.metzenhof.at |
| Buchung | https://mittag.metzenhof.at/buchen.html |
| Admin | https://mittag.metzenhof.at/admin/ |

---

## Häufige Probleme

| Problem | Lösung |
|---------|--------|
| „Ungültiger Admin-Schlüssel“ | ADMIN_KEY in Settings prüfen, exakt so eingeben |
| „Menü wird geladen…“ bleibt | SCRIPT_BASE in app.js prüfen, Web-App als „Jeder“ bereitgestellt? |
| Kein Menü sichtbar | Ist heute Mi/Do/Fr? Im Admin ein Menü angelegt und aktiviert? |
| CORS-Fehler | Web-App muss mit Zugriff **„Jeder“** bereitgestellt sein |
| Domain funktioniert nicht | DNS 10–60 Min. warten, CNAME korrekt eingetragen? |

---

## n8n API (optional)

Für WhatsApp-Broadcast, Küchenübersicht etc.:

| Action | Beispiel-URL |
|--------|--------------|
| Menü abrufen | `SCRIPT_BASE?action=mittag_api_menu&date=2026-03-05` |
| Buchungen pro Slot | `SCRIPT_BASE?action=mittag_api_slots_count&date=2026-03-05` |
| Buchungen exportieren | `SCRIPT_BASE?action=mittag_api_bookings_export&date=2026-03-05&admin_key=DEIN_KEY` |
