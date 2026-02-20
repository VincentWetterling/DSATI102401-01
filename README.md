# LLM Bench — Projekt (DSATI102401-01)

Kurzbeschreibung
----------------

Dieses Repository enthält ein kleines, praxisorientiertes Toolkit zum Benchmarken von Large Language Models (LLMs) sowie ein minimales Web‑Frontend zur Ansicht der Ergebnisse. Ziel ist: einfache Vergleichsläufe (Latenz, Ausgabegröße, Status) für verschiedene Provider / Modelle durchzuführen und Ergebnisse reproduzierbar zu speichern.

Inhalt & Struktur 📁
-------------------

- `llm_bench/` — Kern‑Tooling zum Ausführen von Benchmarks
  - `main.py` — interaktiver CLI‑Entrypoint
  - `bench.py` — Mess‑/Orchestrierungs‑Funktionen
  - `providers.py` — Provider‑Abstraktionen (hier neue Provider hinzufügen)
  - `prompts.json` — Beispiel‑Prompts für Benchmarks
  - `results/` — Ausgabeordner für CSV/JSON Ergebnisse
- `web/` — kleines Single‑Page‑Frontend zur Ergebnisansicht (`index.html`, `script.js`)
- `requirements.txt` — Python‑Abhängigkeiten
- `LICENSE` — Lizenz

Schnellstart — lokal ⚡
---------------------

1. Virtuelle Umgebung erstellen (empfohlen):

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\activate
   pip install -r llm_bench/requirements.txt
   ```

2. API‑Keys / Konfiguration: Kopiere `llm_bench/.env.example` nach `.env` oder setze Umgebungsvariablen.

3. Benchmark ausführen (Beispiel):

   ```powershell
   python llm_bench/main.py
   ```

   - Menü folgen: Provider/Modelle auswählen → Prompt wählen oder eigenen Prompt eingeben → Ergebnis wird in `llm_bench/results/` als CSV gespeichert.

Ergebnisse anzeigen (Web‑Frontend)
----------------------------------

- Öffne `web/index.html` direkt im Browser oder starte einen lokalen Server:

  ```powershell
  cd web
  python -m http.server 8000
  # dann: http://localhost:8000
  ```

- Lade die CSV/JSON aus `llm_bench/results` im Viewer.

Konfiguration & Erweiterung 🔧
----------------------------

- Neue Provider: `llm_bench/providers.py` erweitern (Klassen für API‑Clients).
- Prompts anpassen: `llm_bench/prompts.json` bearbeiten.
- Ergebnisformat: `bench.run_single_benchmark` liefert das Ergebnisobjekt; `main.py` schreibt CSV.