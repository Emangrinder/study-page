import { savedQueue, saveQueue } from "./store.js";

const AGAIN_MIN = 2; // a missed card returns 2-4 cards from now
const AGAIN_MAX = 4;

export class Deck {
  constructor(meta, cards) {
    this.meta = meta;
    this.cards = new Map(cards.map((c) => [c.id, c]));
    const saved = (savedQueue(meta.id) || []).filter((id) => this.cards.has(id));
    const missing = cards.map((c) => c.id).filter((id) => !saved.includes(id));
    this.queue = [...saved, ...missing];
  }

  get top() { return this.cards.get(this.queue[0]); }
  get size() { return this.queue.length; }

  jumpTo(id) {
    this.queue = [id, ...this.queue.filter((x) => x !== id)];
    saveQueue(this.meta.id, this.queue);
  }

  shuffle() {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    saveQueue(this.meta.id, this.queue);
  }

  got() {
    this.queue.push(this.queue.shift());
    saveQueue(this.meta.id, this.queue);
  }

  again() {
    const id = this.queue.shift();
    const at = Math.min(this.queue.length, AGAIN_MIN + Math.floor(Math.random() * (AGAIN_MAX - AGAIN_MIN + 1)));
    this.queue.splice(at, 0, id);
    saveQueue(this.meta.id, this.queue);
  }
}
