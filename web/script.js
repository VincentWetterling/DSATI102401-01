// Kleiner Fragebogen + Scoring für LLM‑Hosting‑Empfehlung (Deutsch)
const defaultQuestions = [
  {
    id: 'data',
    text: 'Wie wichtig ist dir Datensouveränität / Datenschutz?',
    options: [
      { text: 'Sehr wichtig (maximale Datenhoheit)', scores: { local: 3, ionos: 2, aws: 0, proprietary: 0 } },
      { text: 'Wichtig', scores: { local: 2, ionos: 1, aws: 1, proprietary: 0 } },
      { text: 'Eher unwichtig', scores: { local: 0, ionos: 0, aws: 1, proprietary: 2 } },
      { text: 'egal / kein Problem mit Cloud‑Anbietern', scores: { local: 0, ionos: 0, aws: 2, proprietary: 3 } }
    ]
  },
  {
    id: 'budget',
    text: 'Wie wichtig ist dir ein günstiges Budget?',
    options: [
      { text: 'Sehr wichtig (geringste Kosten)', scores: { local: 0, ionos: 3, aws: 0, proprietary: 0 } },
      { text: 'Wichtig', scores: { local: 0, ionos: 2, aws: 0, proprietary: 0 } },
      { text: 'Mittel', scores: { local: 2, ionos: 1, aws: 1, proprietary: 1 } },
      { text: 'Kosten sind sekundär', scores: { local: 2, ionos: 0, aws: 2, proprietary: 2 } }
    ]
  },
  {
    id: 'models',
    text: 'Benötigst du eine große Auswahl an (Open‑Source) Modellen?',
    options: [
      { text: 'Ja, viele Modelle / volle Kontrolle über Modelle', scores: { local: 2, ionos: 0, aws: 3, proprietary: 0 } },
      { text: 'Einige Modelle reichen', scores: { local: 2, ionos: 1, aws: 1, proprietary: 1 } },
      { text: 'Nein, wenige & premium‑Modelle bevorzugt', scores: { local: 0, ionos: 0, aws: 0, proprietary: 3 } }
    ]
  },
  {
    id: 'training',
    text: 'Soll der Provider dein Modell mit deinen Daten weiter trainieren / fine‑tunen?',
    options: [
      { text: 'Nein — auf keinen Fall', scores: { local: 2, ionos: 2, aws: 1, proprietary: 0 } },
      { text: 'Optional / wenn möglich', scores: { local: 1, ionos: 0, aws: 1, proprietary: 1 } },
      { text: 'Ja, Training wichtig', scores: { local: 1, ionos: 0, aws: 2, proprietary: 1 } }
    ]
  },
  {
    id: 'premium',
    text: 'Brauchen Sie Premium‑Leistungsmodelle (z. B. GPT‑4, Gemini Advanced)?',
    options: [
      { text: 'Ja, Premium‑Modelle sind wichtig', scores: { local: 0, ionos: 0, aws: 1, proprietary: 3 } },
      { text: 'Nicht nötig', scores: { local: 2, ionos: 1, aws: 1, proprietary: 0 } }
    ]
  },
  {
    id: 'offline',
    text: 'Soll alles zwingend lokal ohne Internet laufen?',
    options: [
      { text: 'Ja — offline / keine externen APIs', scores: { local: 4, ionos: 0, aws: 0, proprietary: 0 } },
      { text: 'Nein', scores: { local: 0, ionos: 1, aws: 1, proprietary: 1 } }
    ]
  }
];

let questions;
try {
  const saved = localStorage.getItem('llm_questions');
  questions = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(defaultQuestions));
} catch (e) {
  console.warn('Fehler beim Laden der gespeicherten Fragen, lade Standardfragen.', e);
  questions = JSON.parse(JSON.stringify(defaultQuestions));
}

const providers = {
  local: { name: 'Lokal (Ollama)', desc: 'Maximale Datenhoheit / Sicherheit — sehr hohe Kosten.' },
  ionos: { name: 'API (IONOS)', desc: 'Gute Datenschutz‑Option, niedrige Kosten, begrenzte Modellauswahl.' },
  aws: { name: 'Cloud API (AWS)', desc: 'Große Auswahl an Open‑Source‑Modellen, hohe Kosten, Datenschutz (USA).' },
  proprietary: { name: 'Proprietär (OpenAI / Claude / Gemini)', desc: 'Premium‑Modelle, amerikanische Anbieter, Datenschutz abhängig, kein Training ohne Enterprise.' }
};

// --- UI / state ---
let current = 0;
const answers = {}; // questionId -> optionIndex


const qIndexEl = document.getElementById('qIndex');
const qTotalEl = document.getElementById('qTotal');
const qTextEl = document.getElementById('qText');
const optionsEl = document.getElementById('options');
const questionCard = document.getElementById('questionCard');
const intro = document.getElementById('intro');
const resultCard = document.getElementById('resultCard');
const howCard = document.getElementById('howCard');

qTotalEl.textContent = questions.length;

function start() {
  intro.classList.add('hidden');
  howCard.classList.add('hidden');
  resultCard.classList.add('hidden');
  questionCard.classList.remove('hidden');
  current = 0;
  qTotalEl.textContent = questions.length;
  renderQuestion();
}

function renderQuestion() {
  const q = questions[current];
  qIndexEl.textContent = current + 1;
  qTextEl.textContent = q.text;
  optionsEl.innerHTML = '';
  q.options.forEach((opt, i) => {
    const d = document.createElement('div');
    d.className = 'option';
    d.tabIndex = 0;
    d.innerHTML = `<div>${opt.text}</div>`;
    if (answers[q.id] === i) d.classList.add('selected');
    d.addEventListener('click', () => selectOption(q.id, i));
    d.addEventListener('keydown', (e) => { if (e.key === 'Enter') selectOption(q.id, i); });
    optionsEl.appendChild(d);
  });
}

function selectOption(qid, idx) {
  answers[qid] = idx;
  renderQuestion();
}

function goBack() {
  if (current === 0) { intro.classList.remove('hidden'); questionCard.classList.add('hidden'); return; }
  current -= 1;
  renderQuestion();
}

function goNext() {
  const q = questions[current];
  if (answers[q.id] == null) { alert('Bitte eine Option auswählen.'); return; }
  if (current < questions.length - 1) { current += 1; renderQuestion(); return; }
  // fertig -> Ergebnis
  showResult();
}

const explainTemplates = {
  local: {
    data: {
      positive: 'Du hast „{choice}“ gewählt — Lokal bietet vollständige Datenhoheit, weil Daten und Modelle bei dir verbleiben.',
      negative: 'Du hast „{choice}“ gewählt — Lokal ist zwar sicher, spricht aber wegen Aufwand/Kosten evtl. weniger dafür.'
    },
    budget: {
      positive: 'Du hast „{choice}“ gewählt — wenn Kosten sekundär sind, ist ein lokaler Betrieb akzeptabel.',
      negative: 'Du hast „{choice}“ gewählt — Lokal verursacht in der Regel höhere Infrastruktur‑ und Betriebs‑Kosten.'
    },
    models: {
      positive: 'Du hast „{choice}“ gewählt — Lokal erlaubt volle Kontrolle über Open‑Source‑Modelle.',
      negative: 'Du hast „{choice}“ gewählt — Für reine Premium‑Modelle ist Lokal nicht die primäre Stärke.'
    },
    training: {
      positive: 'Du hast „{choice}“ gewählt — Lokal ermöglicht Fine‑Tuning ohne Datenweitergabe an Dritte.',
      negative: 'Du hast „{choice}“ gewählt — Wenn Training irrelevant ist, bietet Lokal keinen speziellen Vorteil.'
    },
    premium: {
      positive: 'Du hast „{choice}“ gewählt — Lokal kann leistungsfähige OSS‑Modelle hosten, aber proprietäre Premium‑Modelle fehlen oft.',
      negative: 'Du hast „{choice}“ gewählt — Wenn Premium‑Modelle nicht benötigt werden, ist Lokal trotzdem passend.'
    },
    offline: {
      positive: 'Du hast „{choice}“ gewählt — Lokal ist ideal für strikt offline laufende Systeme.',
      negative: 'Du hast „{choice}“ gewählt — Wenn Online‑APIs benötigt werden, ist Lokal unpassend.'
    }
  },
  ionos: {
    data: {
      positive: 'Du hast „{choice}“ gewählt — IONOS bietet DSGVO‑freundliche API‑Optionen und hält Daten innerhalb Europas.',
      negative: 'Du hast „{choice}“ gewählt — IONOS ist keine lokale Inhouse‑Lösung, vollständige Datenhoheit entfällt.'
    },
    budget: {
      positive: 'Du hast „{choice}“ gewählt — IONOS ist kostengünstig und eignet sich bei kleinem Budget.',
      negative: 'Du hast „{choice}“ gewählt — Wenn Kosten keine Rolle spielen, bietet IONOS weniger Mehrwert.'
    },
    models: {
      positive: 'Du hast „{choice}“ gewählt — IONOS bietet eine einfache Auswahl, aber keine breite OSS‑Modellvielfalt.',
      negative: 'Du hast „{choice}“ gewählt — Bei hohem Bedarf an Modellvielfalt ist IONOS eingeschränkt.'
    },
    training: {
      positive: 'Du hast „{choice}“ gewählt — IONOS erlaubt meist keine umfangreichen Trainings‑Services, bietet dafür aber Datenschutzvorteile.',
      negative: 'Du hast „{choice}“ gewählt — Wenn aktives Fine‑Tuning wichtig ist, ist IONOS weniger geeignet.'
    },
    premium: {
      positive: 'Du hast „{choice}“ gewählt — IONOS ist eine günstige API‑Option ohne Premium‑Fokus.',
      negative: 'Du hast „{choice}“ gewählt — Für Premium‑Modelle ist IONOS nicht die erste Wahl.'
    },
    offline: {
      positive: 'Du hast „{choice}“ gewählt — IONOS ist ein Cloud‑API‑Anbieter, läuft nicht lokal/offline.',
      negative: 'Du hast „{choice}“ gewählt — Bei strengem Offline‑Betrieb ist IONOS ungeeignet.'
    }
  },
  aws: {
    data: {
      positive: 'Du hast „{choice}“ gewählt — AWS bietet starke Infrastruktur, jedoch sind datenschutzrechtliche Aspekte (US‑Recht) zu beachten.',
      negative: 'Du hast „{choice}“ gewählt — Wenn vollständige Datenhoheit gefordert ist, ist AWS weniger ideal.'
    },
    budget: {
      positive: 'Du hast „{choice}“ gewählt — AWS skaliert gut, kann aber teuer werden.',
      negative: 'Du hast „{choice}“ gewählt — Bei sehr begrenztem Budget ist AWS oft zu kostspielig.'
    },
    models: {
      positive: 'Du hast „{choice}“ gewählt — AWS unterstützt viele Open‑Source‑Modelle und flexible Deployments.',
      negative: 'Du hast „{choice}“ gewählt — Wenn nur wenige Premium‑Modelle erforderlich sind, ist AWS evtl. Overhead.'
    },
    training: {
      positive: 'Du hast „{choice}“ gewählt — AWS bietet umfangreiche Trainings‑ und Fine‑Tuning‑Services.',
      negative: 'Du hast „{choice}“ gewählt — Trainings‑Workflows auf AWS können komplex und kostenintensiv sein.'
    },
    premium: {
      positive: 'Du hast „{choice}“ gewählt — AWS kann leistungsfähige Modelle hosten, aber Premium‑Modelle sind eher proprietären Anbietern vorbehalten.',
      negative: 'Du hast „{choice}“ gewählt — Für direkte Premium‑Services sind proprietäre Anbieter meist besser geeignet.'
    },
    offline: {
      positive: 'Du hast „{choice}“ gewählt — AWS ist Cloud‑basiert und nicht für Offline‑Betrieb gedacht.',
      negative: 'Du hast „{choice}“ gewählt — Bei zwingendem Offline‑Betrieb ist AWS ungeeignet.'
    }
  },
  proprietary: {
    data: {
      positive: 'Du hast „{choice}“ gewählt — Proprietäre Anbieter bieten starke Modelle, jedoch fällt Datenschutz an externe Anbieter an.',
      negative: 'Du hast „{choice}“ gewählt — Wenn Datensouveränität oberste Priorität hat, sind proprietäre Anbieter weniger geeignet.'
    },
    budget: {
      positive: 'Du hast „{choice}“ gewählt — Proprietäre APIs bieten oft hohe Leistung, können aber kostenintensiv sein.',
      negative: 'Du hast „{choice}“ gewählt — Bei sehr kleinem Budget sind proprietäre Anbieter oft zu teuer.'
    },
    models: {
      positive: 'Du hast „{choice}“ gewählt — Proprietäre Anbieter liefern Premium‑Modelle mit hoher Performance.',
      negative: 'Du hast „{choice}“ gewählt — Wenn du viele Open‑Source‑Modelle brauchst, ist die Auswahl begrenzt.'
    },
    training: {
      positive: 'Du hast „{choice}“ gewählt — Enterprise‑Angebote können private Fine‑Tuning‑Optionen anbieten.',
      negative: 'Du hast „{choice}“ gewählt — Standard‑APIs trainieren Modelle nicht zwangsläufig mit deinen Daten.'
    },
    premium: {
      positive: 'Du hast „{choice}“ gewählt — Proprietäre Anbieter sind die erste Wahl für Premium‑Modelle.',
      negative: 'Du hast „{choice}“ gewählt — Wenn Premium nicht benötigt wird, sind günstigere Optionen sinnvoll.'
    },
    offline: {
      positive: 'Du hast „{choice}“ gewählt — Proprietäre APIs sind cloudbasiert und nicht offline‑fähig.',
      negative: 'Du hast „{choice}“ gewählt — Für Offline‑Betrieb sind proprietäre Anbieter ungeeignet.'
    }
  }
};

function getExplanation(providerKey, q, chosenIndex, contrib) {
  const templates = explainTemplates[providerKey] && explainTemplates[providerKey][q.id];
  const choiceText = q.options[chosenIndex].text;
  if (!templates) return '';
  return (contrib > 0 ? templates.positive : templates.negative).replace('{choice}', choiceText);
}

function showResult() {
  questionCard.classList.add('hidden');
  resultCard.classList.remove('hidden');

  // Score berechnen
  const scoreMap = { local: 0, ionos: 0, aws: 0, proprietary: 0 };
  questions.forEach((q) => {
    const chosen = answers[q.id];
    const s = q.options[chosen].scores;
    Object.keys(s).forEach(k => scoreMap[k] += s[k]);
  });

  // Sortiert nach Score
  const sorted = Object.keys(scoreMap).map(k => ({ key: k, score: scoreMap[k] }))
    .sort((a, b) => b.score - a.score);

  const best = sorted[0];
  const bestProv = providers[best.key];

  // Empfehlung anzeigen
  const recEl = document.getElementById('recommendation');
  recEl.innerHTML = `<h3>${bestProv.name} — Empfehlung</h3><div>${bestProv.desc}</div><div style="margin-top:8px;color:var(--muted);">Score: ${best.score}</div>`;

  // --- breakdown: positive / negative Punkte pro Provider (mit Erklärungen) ---
  const breakdown = {};
  Object.keys(providers).forEach(k => breakdown[k] = { positives: [], negatives: [] });

  questions.forEach((q) => {
    const chosen = answers[q.id];
    const choiceText = q.options[chosen].text;
    Object.keys(providers).forEach((k) => {
      const contrib = (q.options[chosen].scores[k]) || 0;
      const summary = `${q.text} — "${choiceText}" ${contrib > 0 ? '(+' + contrib + ')' : ''}`;
      const explanation = getExplanation(k, q, chosen, contrib);
      if (contrib > 0) breakdown[k].positives.push({ summary, explanation });
      else breakdown[k].negatives.push({ summary, explanation });
    });
  });

  // Empfehlung: positive / negative Punkte anzeigen (mit Erklärung)
  const posEl = document.getElementById('positives');
  const negEl = document.getElementById('negatives');
  posEl.innerHTML = breakdown[best.key].positives.length
    ? breakdown[best.key].positives.map(p => `<li><div>${p.summary}</div><div class="explain">${p.explanation}</div></li>`).join('')
    : '<li>Keine positiven Punkte basierend auf deinen Antworten.</li>';
  negEl.innerHTML = breakdown[best.key].negatives.length
    ? breakdown[best.key].negatives.map(p => `<li><div>${p.summary}</div><div class="explain">${p.explanation}</div></li>`).join('')
    : '<li>Keine negativen Punkte.</li>';

  // 'Warum?' entfernt — Erklärungen sind jetzt unter Positive / Negative aufgeführt.


  // weitere Optionen anzeigen (mit compact Pro/Contra + Erklärungen)
  const otherList = document.getElementById('otherList');
  otherList.innerHTML = '';
  sorted.filter(item => item.key !== best.key).forEach(item => {
    const pInfo = providers[item.key];
    const pos = breakdown[item.key].positives.slice(0, 3);
    const neg = breakdown[item.key].negatives.slice(0, 3);
    const div = document.createElement('div');
    div.className = 'other-item';
    div.innerHTML = `
      <strong>${pInfo.name}</strong> — Score: ${item.score}
      <div style="display:flex;gap:12px;margin-top:8px">
        <div style="flex:1"><small style="color:#86efac">Positiv</small><ul class="reasons positive-mini">${pos.map(x => `<li>${x.summary}<div class=\"explain\">${x.explanation}</div></li>`).join('')}</ul></div>
        <div style="flex:1"><small style="color:#fca5a5">Negativ</small><ul class="reasons negative-mini">${neg.map(x => `<li>${x.summary}<div class=\"explain\">${x.explanation}</div></li>`).join('')}</ul></div>
      </div>
      <div style="color:var(--muted);margin-top:8px">${pInfo.desc}</div>
    `;
    otherList.appendChild(div);
  });
}

function restart() { Object.keys(answers).forEach(k => delete answers[k]); start(); }

function exportResult() {
  const data = { answers: {}, summary: {}, breakdown: {} };
  questions.forEach(q => { data.answers[q.id] = q.options[answers[q.id]]?.text ?? null; });

  // compute scores and breakdown (include explanations)
  const scoreMap = { local: 0, ionos: 0, aws: 0, proprietary: 0 };
  const breakdown = {};
  Object.keys(providers).forEach(k => breakdown[k] = { positives: [], negatives: [] });

  questions.forEach((q) => {
    const chosen = answers[q.id];
    const choiceText = q.options[chosen].text;
    const s = q.options[chosen].scores;
    Object.keys(s).forEach(k => {
      scoreMap[k] += s[k];
      const contrib = s[k] || 0;
      const summary = `${q.text} — ${choiceText} ${contrib > 0 ? '(+' + contrib + ')' : ''}`;
      const explanation = getExplanation(k, q, chosen, contrib);
      if (contrib > 0) breakdown[k].positives.push({ summary, explanation });
      else breakdown[k].negatives.push({ summary, explanation });
    });
  });

  Object.keys(scoreMap).forEach(k => data.summary[k] = scoreMap[k]);
  Object.keys(breakdown).forEach(k => data.breakdown[k] = breakdown[k]);

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'llm_choice_result.json';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// --- Config UI helpers & persistence ---
function saveQuestionsToStorage() {
  try { localStorage.setItem('llm_questions', JSON.stringify(questions)); } catch (e) { console.warn('Speichern fehlgeschlagen', e); }
}

function renderConfigForm() {
  const container = document.getElementById('configForm');
  container.innerHTML = '';
  questions.forEach((q, qi) => {
    const qDiv = document.createElement('div');
    qDiv.className = 'config-question';

    const hdr = document.createElement('div'); hdr.className = 'config-q-header';
    const idLabel = document.createElement('label'); idLabel.textContent = 'ID';
    const idInput = document.createElement('input'); idInput.className = 'q-id'; idInput.type = 'text'; idInput.value = q.id;
    const textLabel = document.createElement('label'); textLabel.textContent = 'Fragetext';
    const textInput = document.createElement('input'); textInput.className = 'q-text'; textInput.type = 'text'; textInput.value = q.text; textInput.style.width = '56%';
    const removeQ = document.createElement('button'); removeQ.type = 'button'; removeQ.className = 'btn remove-question'; removeQ.textContent = 'Frage entfernen';
    removeQ.addEventListener('click', () => qDiv.remove());

    hdr.appendChild(idLabel); hdr.appendChild(idInput); hdr.appendChild(textLabel); hdr.appendChild(textInput); hdr.appendChild(removeQ);
    qDiv.appendChild(hdr);

    const optsContainer = document.createElement('div'); optsContainer.className = 'config-options';

    q.options.forEach(opt => {
      const optEl = createOptionElement(opt);
      optsContainer.appendChild(optEl);
    });

    const addOpt = document.createElement('button'); addOpt.type = 'button'; addOpt.className = 'btn add-option-btn'; addOpt.textContent = 'Option hinzufügen';
    addOpt.addEventListener('click', () => {
      const newOpt = { text: 'Neue Option', scores: { local: 0, ionos: 0, aws: 0, proprietary: 0 } };
      optsContainer.appendChild(createOptionElement(newOpt));
    });

    qDiv.appendChild(optsContainer);
    qDiv.appendChild(addOpt);
    container.appendChild(qDiv);
  });
}

function createOptionElement(opt) {
  const optEl = document.createElement('div'); optEl.className = 'config-option';
  const textIn = document.createElement('input'); textIn.className = 'opt-text'; textIn.type = 'text'; textIn.value = opt.text; textIn.style.width = '40%';
  const scoresDiv = document.createElement('div'); scoresDiv.className = 'scores';
  ['local','ionos','aws','proprietary'].forEach(k => {
    const f = document.createElement('div'); f.className = 'score-field';
    const lbl = document.createElement('label'); lbl.textContent = k;
    const num = document.createElement('input'); num.className = 'score-' + k; num.type = 'number'; num.step = '1'; num.value = (opt.scores && typeof opt.scores[k] === 'number') ? opt.scores[k] : 0;
    f.appendChild(lbl); f.appendChild(num); scoresDiv.appendChild(f);
  });
  const removeBtn = document.createElement('button'); removeBtn.type = 'button'; removeBtn.className = 'btn remove-option'; removeBtn.textContent = 'Entfernen';
  removeBtn.addEventListener('click', () => optEl.remove());
  optEl.appendChild(textIn); optEl.appendChild(scoresDiv); optEl.appendChild(removeBtn);
  return optEl;
}

function addQuestion() {
  const baseId = 'q_' + Math.random().toString(36).slice(2,7);
  const newQ = { id: baseId, text: 'Neue Frage', options: [{ text: 'Neue Option', scores: { local: 0, ionos: 0, aws: 0, proprietary: 0 } }] };
  questions.push(newQ);
  saveQuestionsToStorage();
  renderConfigForm();
}

function openConfig() {
  document.getElementById('configCard').classList.remove('hidden');
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('questionCard').classList.add('hidden');
  document.getElementById('resultCard').classList.add('hidden');
  document.getElementById('howCard').classList.add('hidden');
  renderConfigForm();
}
function closeConfig() {
  document.getElementById('configCard').classList.add('hidden');
  document.getElementById('intro').classList.remove('hidden');
}

function validateQuestions(obj) {
  if (!Array.isArray(obj)) return 'JSON muss ein Array von Fragen sein.';
  const ids = new Set();
  for (const q of obj) {
    if (!q.id || !q.text || !Array.isArray(q.options) || q.options.length === 0) return 'Jede Frage benötigt id, text und mindestens eine Option';
    if (ids.has(q.id)) return 'Frage-IDs müssen eindeutig sein';
    ids.add(q.id);
    for (const o of q.options) {
      if (typeof o.text !== 'string' || typeof o.scores !== 'object') return 'Jede Option benötigt text und scores-Objekt';
      const keys = ['local','ionos','aws','proprietary'];
      for (const k of keys) if (typeof o.scores[k] !== 'number') return 'Scores müssen Zahlen für alle Provider enthalten';
    }
  }
  return null;
}

function applyConfig() {
  // read form DOM into questions array
  const qNodes = Array.from(document.querySelectorAll('.config-question'));
  const parsed = [];
  for (const qn of qNodes) {
    const id = (qn.querySelector('.q-id')?.value || '').trim();
    const text = (qn.querySelector('.q-text')?.value || '').trim();
    const optNodes = Array.from(qn.querySelectorAll('.config-option'));
    const options = optNodes.map(on => {
      return {
        text: (on.querySelector('.opt-text')?.value || '').trim(),
        scores: {
          local: parseInt(on.querySelector('.score-local')?.value || 0, 10),
          ionos: parseInt(on.querySelector('.score-ionos')?.value || 0, 10),
          aws: parseInt(on.querySelector('.score-aws')?.value || 0, 10),
          proprietary: parseInt(on.querySelector('.score-proprietary')?.value || 0, 10)
        }
      };
    });
    parsed.push({ id, text, options });
  }

  const err = validateQuestions(parsed);
  if (err) { alert('Ungültige Konfiguration: ' + err); return; }
  questions = parsed;
  saveQuestionsToStorage();
  alert('Konfiguration übernommen. Fragebogen wurde aktualisiert.');
  closeConfig();
  qTotalEl.textContent = questions.length;
  start();
}

function resetConfigToDefault() {
  if (!confirm('Auf Standard zurücksetzen? Alle lokalen Änderungen gehen verloren.')) return;
  questions = JSON.parse(JSON.stringify(defaultQuestions));
  saveQuestionsToStorage();
  renderConfigForm();
  alert('Zurückgesetzt.');
  qTotalEl.textContent = questions.length;
  start();
}

function exportConfig() {
  const blob = new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'llm_questions_config.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function importConfigFromInput(files) {
  const f = files && files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const err = validateQuestions(parsed);
      if (err) { alert('Importfehler: ' + err); return; }
      questions = parsed; saveQuestionsToStorage(); renderConfigForm();
      alert('Konfiguration importiert.'); qTotalEl.textContent = questions.length; start();
    } catch (e) { alert('Import: ungültiges JSON - ' + e.message); }
  };
  reader.readAsText(f);
}

// --- Event hooks ---
document.getElementById('startBtn').addEventListener('click', start);
document.getElementById('backBtn').addEventListener('click', goBack);
document.getElementById('nextBtn').addEventListener('click', goNext);
document.getElementById('restartBtn').addEventListener('click', restart);
document.getElementById('exportBtn').addEventListener('click', exportResult);
document.getElementById('howBtn').addEventListener('click', () => { howCard.classList.remove('hidden'); intro.classList.add('hidden'); });
document.getElementById('closeHow').addEventListener('click', () => { howCard.classList.add('hidden'); intro.classList.remove('hidden'); });

// Config buttons
document.getElementById('configBtn').addEventListener('click', openConfig);
document.getElementById('addQuestionBtn').addEventListener('click', addQuestion);
document.getElementById('applyConfigBtn').addEventListener('click', applyConfig);
document.getElementById('resetConfigBtn').addEventListener('click', resetConfigToDefault);
document.getElementById('exportConfigBtn').addEventListener('click', exportConfig);
document.getElementById('importConfigBtn').addEventListener('click', () => document.getElementById('importConfigInput').click());
document.getElementById('importConfigInput').addEventListener('change', (e) => importConfigFromInput(e.target.files));
document.getElementById('closeConfigBtn').addEventListener('click', closeConfig);

// Accessibility: start with intro visible
start();