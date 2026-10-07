const KEY = "study-deck:v1";

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

let data = read();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
}

export function savedQueue(deckId) {
  return data.queues?.[deckId] || null;
}

export function saveQueue(deckId, queue) {
  data.queues = data.queues || {};
  data.queues[deckId] = queue;
  save();
}

export function lastExam() { return data.lastExam || null; }
export function lastDeckFor(examId) { return data.lastDecks?.[examId] || null; }
export function setLast(examId, deckId) {
  data.lastExam = examId;
  data.lastDecks = { ...data.lastDecks, [examId]: deckId };
  save();
}

export function shuffleOn() { return Boolean(data.shuffle); }
export function setShuffleOn(on) { data.shuffle = on; save(); }

// delay before the small caption under a card's text fades in: milliseconds, 0 = instant, -1 = never
export function subDelay() { return Number.isFinite(data.subDelay) ? data.subDelay : 0; }
export function setSubDelay(ms) { data.subDelay = ms; save(); }
