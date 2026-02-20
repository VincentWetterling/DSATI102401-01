# llm_bench — einfacher LLM-Vergleich (lokal / API / Cloud / proprietär)

Kurz: Dieses kleine Python-Tool führt Benchmarks für mehrere LLM-Anbieter durch und misst TTFT (Time To First Token), Gesamtdauer und Ausgabelänge. Ergebnisse werden als CSV exportiert.

Sensible Defaults / Konzepte
- Unterstützte Anbieter (Beispiele): Ollama (lokal), OpenAI, IONOS, AWS (Cloud API), Anthropic (Claude), Google Gemini
- CLI-Auswahl: single | multiple | all — zusätzlich Modell-Auswahl pro Anbieter
- Ausgabe: CSV in `results/`

Installation
1. Python 3.9+ verwenden
2. Abhängigkeiten installieren:
   pip install -r requirements.txt
3. `.env` anlegen (siehe `.env.example`) oder Umgebungsvariablen setzen

Benutzung
- Starte: python main.py
- Folge den Eingaben: Anbieter wählen → Modell(s) wählen → Prompt wählen oder direkt eingeben → Benchmark läuft → CSV wird in `results/` geschrieben

Wichtig
- Dieses Tool versucht Standard-Endpunkte (OpenAI, Anthropic, Ollama) zu nutzen, ist aber absichtlich tolerant: du kannst Base-URLs und Modellnamen in der `.env` setzen.
- Minimal-Dokumentation ist in den Funktionen als Deutsche Docstrings hinterlegt.

Lizenz: MIT (Beispielprojekt)
