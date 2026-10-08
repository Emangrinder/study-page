import { rich, plainLength } from "./rich.js";
import { subDelay } from "./store.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// Schematic drawings and flags come from our own data files; strip anything scriptable anyway.
function setFigure(box, side) {
  box.replaceChildren();
  if (side.img) {
    const img = document.createElement("img");
    img.src = side.img;
    img.alt = side.alt || "";
    img.decoding = "async";
    box.append(img);
    return;
  }
  if (!side.svg) return;
  const svg = new DOMParser().parseFromString(side.svg, "image/svg+xml").documentElement;
  if (svg.nodeName !== "svg") return;
  svg.querySelectorAll("script, foreignObject").forEach((n) => n.remove());
  [svg, ...svg.querySelectorAll("*")].forEach((n) => {
    [...n.attributes].forEach((a) => { if (/^on/i.test(a.name) || /javascript:/i.test(a.value)) n.removeAttribute(a.name); });
  });
  box.append(document.importNode(svg, true));
}

// Owns the card element: tilt, drag follow-through, multi-sided flipping, exit animation.
export class CardView {
  constructor({ stage, card, flipper, under }, gradeDist) {
    this.stage = stage;
    this.under = under;
    this.underFace = under.querySelector(".face");
    this.card = card;
    this.flipper = flipper;
    this.faces = [...flipper.querySelectorAll(".face")];
    this.gradeDist = gradeDist;
    this.sides = [];
    this.side = 0;
    this.angle = 0;
    this.t = { tx: 0, ty: 0, rx: 0, ry: 0, rz: 0, s: 1 };
  }

  get sideCount() { return this.sides.length; }
  get visibleFace() { return ((Math.round(this.angle / 180) % 2) + 2) % 2; }

  fill(face, side, hold = false) {
    const text = side.text || "";
    setFigure(face.querySelector(".figure"), side);
    face.classList.toggle("hasfig", Boolean(side.svg || side.img));
    face.classList.toggle("hascode", Boolean(side.code));
    face.classList.toggle("steps", side.sub === "Steps");
    face.querySelector(".head").textContent = side.head || "";
    face.classList.toggle("hashead", Boolean(side.head));
    const textEl = face.querySelector(".text");
    rich(textEl, text, hold || text.includes("\n"));
    const size = plainLength(text);
    textEl.classList.toggle("long", size > 60);
    textEl.classList.toggle("longer", size > 110);
    textEl.classList.toggle("huge", size > 170);
    textEl.classList.toggle("tok", /\S{22,}/.test(text.replace(/\\[\(\[][\s\S]*?\\[\)\]]/g, "")));
    const subEl = face.querySelector(".sub");
    rich(subEl, side.sub || "");
    this.fadeSub(subEl);
    face.querySelector(".code").textContent = side.code || "";
    face.classList.toggle("anchored", !!side.low);
    face.classList.toggle("quiz", Boolean(side.options));
    face.querySelector(".options").replaceChildren(...(side.options || []).map((option, i) => {
      const row = document.createElement("div");
      row.className = "opt";
      row.innerHTML = "<b></b><span></span>";
      row.firstChild.textContent = "ABCD"[i];
      rich(row.lastChild, option);
      return row;
    }));
  }

  // the caption under the text appears after the saved delay, fading in gradually
  fadeSub(el) {
    const ms = subDelay();
    el.classList.remove("fade", "never");
    if (ms === 0 || !el.textContent) return;
    if (ms < 0) return el.classList.add("never");
    el.style.setProperty("--sub-delay", `${ms}ms`);
    void el.offsetWidth;
    el.classList.add("fade");
  }

  refreshSubs() { this.faces.forEach((f) => this.fadeSub(f.querySelector(".sub"))); }

  // the card beneath shows the next card; it rises into place as the top card leaves
  setUnder(card) {
    this.fill(this.underFace, card.sides[0]);
    this.under.classList.remove("rise", "track");
    this.under.style.transform = "";
  }

  promote(card) {
    this.fill(this.underFace, card.sides[0]);
    this.under.classList.remove("track");
    this.under.style.transform = "none";
    this.under.style.filter = "none";
    this.stage.classList.add("advance");
  }

  // while dragging, the card beneath moves up in proportion to the drag
  follow(amount) {
    const a = clamp(amount);
    this.under.classList.add("track");
    this.under.style.transform = `translateY(${12 * (1 - a)}px) scaleX(${0.96 + 0.04 * a})`;
    this.under.style.filter = `brightness(${0.92 + 0.08 * a})`;
  }

  unfollow() {
    this.under.classList.remove("track");
    this.under.style.transform = "";
    this.under.style.filter = "";
  }

  show(card, next, quiet = false) {
    this.stage.classList.add("snap");
    this.stage.classList.remove("advance");
    this.under.classList.add("track");
    this.under.classList.remove("rise");
    this.under.style.transform = "";
    this.under.style.filter = "";
    if (next) this.setUnder(next);
    void this.stage.offsetWidth;
    this.stage.classList.remove("snap");
    this.under.classList.remove("track");

    this.sides = card.sides;
    this.side = 0;
    this.angle = 0;
    this.faces.forEach((f) => f.classList.remove("peek"));
    this.flipper.classList.add("instant");
    this.flipper.style.transform = "rotateY(0deg)";
    this.fill(this.faces[0], this.sides[0]);
    this.fill(this.faces[1], this.sides[Math.min(1, this.sides.length - 1)]);
    void this.flipper.offsetWidth;
    this.flipper.classList.remove("instant");
    this.reset();
    this.card.classList.remove("enter");
    void this.card.offsetWidth;
    if (!quiet) this.card.classList.add("enter");
  }

  // hold: swap the visible face to its hidden "more" layer; release puts the side back
  peek(on) {
    const side = this.sides[this.side];
    const face = this.faces[this.visibleFace];
    if (on && !side.more) return false;
    this.fill(face, on ? side.more : side, on);
    face.classList.toggle("peek", on);
    if (on) navigator.vibrate?.(10);
    return true;
  }

  flip(dir) {
    const n = this.sides.length;
    if (n < 2) return this.nudge();
    this.side = (this.side + dir + n) % n;
    this.fill(this.faces[1 - this.visibleFace], this.sides[this.side]);
    this.angle -= dir * 180;
    this.flipper.style.transform = `rotateY(${this.angle}deg)`;
    navigator.vibrate?.(8);
  }

  nudge() {
    this.set({ tx: 10 });
    this.settle();
    setTimeout(() => this.settle(), 90);
  }

  apply() {
    const { tx, ty, rx, ry, rz, s } = this.t;
    this.card.style.transform = `translate3d(${tx}px, ${ty}px, 0) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`;
  }

  set(patch) { Object.assign(this.t, patch); this.apply(); }

  reset() {
    this.card.classList.remove("leave", "dragging");
    this.t = { tx: 0, ty: 0, rx: 0, ry: 0, rz: 0, s: 1 };
    this.card.style.opacity = "";
    this.card.style.setProperty("--glare", 0);
    this.tint(0);
    this.apply();
  }

  settle() {
    this.unfollow();
    this.card.classList.remove("dragging");
    this.card.classList.add("settle");
    this.set({ tx: 0, ty: 0, rx: 0, ry: 0, rz: 0, s: 1 });
    this.card.style.setProperty("--glare", 0);
    this.tint(0);
  }

  glare({ px, py }) {
    this.card.style.setProperty("--gx", `${px * 100}%`);
    this.card.style.setProperty("--gy", `${py * 100}%`);
    this.card.style.setProperty("--glare", 1);
  }

  hover(p) {
    this.card.classList.add("settle");
    this.set({ ry: (p.px - 0.5) * 10, rx: -(p.py - 0.5) * 10 });
    this.glare(p);
  }

  hoverEnd() { this.settle(); }

  press(p) {
    this.card.classList.remove("settle");
    this.card.classList.add("dragging");
    this.set({ s: 0.965, ry: (p.px - 0.5) * 18, rx: -(p.py - 0.5) * 18 });
    this.glare(p);
  }

  drag({ dx, dy, axis, px, py }) {
    const tiltY = (px - 0.5) * 14;
    const tiltX = -(py - 0.5) * 14;
    if (axis === "x") {
      this.set({ tx: dx * 0.45, ty: dy * 0.1, rz: dx * 0.015, ry: tiltY + dx * 0.1, rx: tiltX });
      this.tint(0);
    } else if (axis === "y") {
      this.set({ tx: dx * 0.3, ty: dy, rz: dx * 0.03, ry: tiltY, rx: tiltX - dy * 0.03 });
      this.tint(dy);
    } else {
      this.set({ ry: tiltY, rx: tiltX });
    }
    this.follow(Math.hypot(dx, dy) / (this.gradeDist * 1.6));
    this.glare({ px, py });
  }

  // the border drifts toward red (up, again) or green (down, got it) as you drag
  tint(dy) {
    const amount = clamp(Math.abs(dy) / this.gradeDist);
    if (amount) this.card.style.setProperty("--tint", dy < 0 ? "var(--miss)" : "var(--got)");
    this.card.style.setProperty("--t", amount);
  }

  async leave(direction) {
    const y = direction === "up" ? -130 : 130;
    this.card.classList.remove("dragging", "settle");
    this.card.classList.add("leave");
    this.set({ ty: window.innerHeight * (y / 100), rz: direction === "up" ? -10 : 10, s: 0.9 });
    await wait(330);
  }
}
