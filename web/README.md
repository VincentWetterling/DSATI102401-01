Nutzwertanalyse‑Tool für Hosting‑Optionen — kleine Single‑Page Website

Wie nutzen:
- Öffne `web/index.html` im Browser (lokal) oder starte im Ordner einen einfachen Server: `python -m http.server 8000` und öffne `http://localhost:8000`.
- Unter "Kriterien & Gewichtung" kannst du Kriterien hinzufügen, deren Gewichtung festlegen und für jede Option (Lokal/API/Cloud/Proprietär) Punkte (z. B. 0–5) vergeben.
- Anschließend klicke auf "Berechnung starten", um das Ergebnis zu sehen. Die Einstellung wird im Browser (`localStorage`) gespeichert.

Anpassen:
- Die Standardkriterien und Punktwerte sind in `web/script.js` definiert (`defaultQuestions`). Du kannst die Listen im Konfigurationsbereich bearbeiten oder die Datei direkt anpassen.

Zweck:
- Einfaches Berechnungstool zur Bewertung verschiedener LLM‑Hosting‑Varianten nach eigenen Kriterien und Gewichtungen.