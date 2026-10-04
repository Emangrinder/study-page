const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// Schematic drawings come from our own data files; strip anything scriptable anyway.
function setFigure(box, markup) {
  box.replaceChildren();
  if (!markup) return;
  const svg = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
  if (svg.nodeName !== "svg") return;
  svg.querySelectorAll("script, foreignObject").forEach((n) => n.remove());
  [svg, ...svg.querySelectorAll("*")].forEach((n) => {
    [...n.attributes].forEach((a) => { if (/^on/i.test(a.name) || /javascript:/i.test(a.value)) n.removeAttribute(a.name); });
  });
  box.append(document.importNode(svg, true));
}

// Owns the card element: tilt, drag follow-through, multi-sided flipping, exit animation.
export class CardView {
  constructor({ stage, card, flipper }, gradeDist) {
    this.stage = stage;
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

  fill(face, side) {
    setFigure(face.querySelector(".figure"), side.svg);
    face.classList.toggle("hasfig", Boolean(side.svg));
    const text = face.querySelector(".text");
    text.textContent = side.text;
    text.classList.toggle("long", side.text.length > 60);
    text.classList.toggle("longer", side.text.length > 110);
    face.querySelector(".sub").textContent = side.sub || "";
    face.classList.toggle("anchored", !!side.low);
    face.classList.toggle("quiz", Boolean(side.options));
    face.querySelector(".options").replaceChildren(...(side.options || []).map((option, i) => {
      const row = document.createElement("div");
      row.className = "opt";
      row.innerHTML = "<b></b><span></span>";
      row.firstChild.textContent = "ABCD"[i];
      row.lastChild.textContent = option;
      return row;
    }));
  }

  show(card) {
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
    this.card.classList.add("enter");
  }

  // hold: swap the visible face to its hidden "more" layer; release puts the side back
  peek(on) {
    const side = this.sides[this.side];
    const face = this.faces[this.visibleFace];
    if (on && !side.more) return false;
    this.fill(face, on ? side.more : side);
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
