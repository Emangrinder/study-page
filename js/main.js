import { Deck } from "./deck.js";
import { CardView } from "./card-view.js";
import { attachGestures } from "./gestures.js";
import { lastExam, lastDeckFor, setLast, shuffleOn, setShuffleOn } from "./store.js";

const $ = (id) => document.getElementById(id);
const stage = $("stage");

let exams = [];
let exam = null;
let deck = null;
let busy = false;
let view = null;
let shuffling = shuffleOn();
let shufflePending = false; // shuffle waits until the current card is finished

const getJSON = async (url) => (await fetch(url)).json();

async function openDeck(nextExam, meta) {
  const { cards } = await getJSON(meta.file);
  exam = nextExam;
  deck = new Deck(meta, cards);
  if (shuffling) deck.shuffle();
  shufflePending = false;
  setLast(exam.id, meta.id);
  const root = document.documentElement.style;
  root.setProperty("--accent", exam.accent);
  root.setProperty("--accent2", exam.accent2);
  $("title").textContent = `${exam.name} · ${meta.name}`;
  renderMenu();
  view.show(deck.top);
  hud();
}

const openGroups = new Set(); // remembers which dropdowns are expanded

function dropdown(className, key, label, children, accent) {
  const details = document.createElement("details");
  details.className = className;
  details.open = openGroups.has(key);
  details.addEventListener("toggle", () => details.open ? openGroups.add(key) : openGroups.delete(key));
  const summary = document.createElement("summary");
  summary.textContent = label;
  if (accent) summary.style.setProperty("--g", accent);
  details.append(summary, ...children);
  return details;
}

function deckButton(e, d) {
  const b = document.createElement("button");
  b.setAttribute("role", "menuitemradio");
  b.setAttribute("aria-checked", d.id === deck.meta.id);
  b.innerHTML = "<span></span><small></small>";
  b.firstChild.textContent = d.name;
  b.lastChild.textContent = d.subtitle || "";
  b.addEventListener("click", () => {
    closeMenu();
    if (d.id !== deck.meta.id) openDeck(e, d);
  });
  return b;
}

function renderMenu() {
  openGroups.add(exam.id);
  if (deck.meta.section) openGroups.add(`${exam.id}:${deck.meta.section}`);
  $("menu").replaceChildren(...exams.map((e) => {
    const sections = [...new Set(e.decks.map((d) => d.section).filter(Boolean))];
    const loose = e.decks.filter((d) => !d.section).map((d) => deckButton(e, d));
    const grouped = sections.map((name) => dropdown("section", `${e.id}:${name}`, name,
      e.decks.filter((d) => d.section === name).map((d) => deckButton(e, d))));
    return dropdown("group", e.id, e.name, [...loose, ...grouped], e.accent);
  }));
}

function setMenu(open) {
  $("menu").hidden = !open;
  $("waffle").setAttribute("aria-expanded", open);
}

function toggleMenu() { setMenu($("menu").hidden); }
function closeMenu() { if (!$("menu").hidden) setMenu(false); }

function hud() {
  $("count").textContent = deck.size;
  $("count").title = `${deck.size} cards in this deck`;
  $("sides").replaceChildren(...Array.from({ length: view.sideCount }, (_, i) => {
    const dot = document.createElement("i");
    dot.classList.toggle("on", i === view.side);
    dot.classList.toggle("more", Boolean(view.sides[i].more));
    return dot;
  }));
}

async function grade(direction) {
  if (busy) return;
  busy = true;
  navigator.vibrate?.(direction === "up" ? [10, 40, 10] : 14);
  await view.leave(direction);
  direction === "up" ? deck.again() : deck.got();
  if (shufflePending) { deck.shuffle(); shufflePending = false; }
  view.show(deck.top);
  hud();
  busy = false;
}

function flip(dir) {
  if (busy) return;
  view.flip(dir);
  hud();
}

async function start() {
  ({ exams } = await getJSON("data/index.json"));

  const { GRADE_DIST } = attachGestures($("card"), {
    locked: () => busy,
    hover: (p) => view.hover(p),
    hoverEnd: () => view.hoverEnd(),
    press: (p) => { closeMenu(); view.press(p); },
    hold: (on) => view.peek(on),
    move: (d) => view.drag(d),
    release: ({ action, px }) => {
      if (action === "up" || action === "down") return grade(action);
      view.settle();
      // a tap turns the card away from the side you pressed, like a swipe toward that side
      if (action === "flipNext" || (action === "tap" && px < 0.5)) flip(1);
      if (action === "flipPrev" || (action === "tap" && px >= 0.5)) flip(-1);
    },
  });

  view = new CardView({ stage, card: $("card"), flipper: $("flipper") }, GRADE_DIST);

  const startExam = exams.find((e) => e.id === lastExam()) || exams[0];
  const startDeck = startExam.decks.find((d) => d.id === lastDeckFor(startExam.id)) || startExam.decks[0];
  await openDeck(startExam, startDeck);

  $("shuffle").setAttribute("aria-pressed", shuffling);
  $("shuffle").addEventListener("click", () => {
    shuffling = !shuffling;
    shufflePending = shuffling;
    setShuffleOn(shuffling);
    $("shuffle").setAttribute("aria-pressed", shuffling);
  });
  $("waffle").addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(); });
  document.addEventListener("click", (e) => { if (!$("menu").contains(e.target)) closeMenu(); });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") return closeMenu();
    const map = { ArrowLeft: () => flip(1), ArrowRight: () => flip(-1), " ": () => flip(1), ArrowUp: () => grade("up"), ArrowDown: () => grade("down") };
    if (map[e.key]) { e.preventDefault(); map[e.key](); }
  });
}

start();
