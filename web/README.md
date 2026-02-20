LLM Hosting‑Berater — kleine Single‑Page Website

Wie nutzen:
- Öffne `llm_bench/web/index.html` im Browser (lokal) oder starte im Ordner einen einfachen Server: `python -m http.server 8000` und öffne `http://localhost:8000`.
- Beantworte die Fragen, am Ende bekommst du eine Empfehlung mit kurzer Begründung.

Anpassen:
- Fragen und Gewichtung in `script.js` (Array `questions`) bearbeiten.
- Texte sind auf Deutsch.

Zweck:
- Schnelle Entscheidungshilfe zwischen: Lokal (Ollama), API (IONOS), Cloud API (AWS) und proprietären Anbietern (OpenAI, Claude, Gemini).