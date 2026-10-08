const AXIS_LOCK = 8;      // px before we decide horizontal vs vertical
const FLIP_DIST = 55;     // px sideways to flip
const FLICK_SPEED = 0.45; // px/ms counts as a flick
const GRADE_DIST = 90;    // px vertically to grade
const TAP_MAX = 8;
const HOLD_MS = 450;      // press and hold this long to peek the hidden layer

// Turns raw pointer events into: press, move, release with a decided action.
export function attachGestures(el, cb) {
  let st = null;

  const local = (e) => {
    const r = el.getBoundingClientRect();
    return { px: (e.clientX - r.left) / r.width, py: (e.clientY - r.top) / r.height };
  };

  el.addEventListener("pointerdown", (e) => {
    if (cb.locked()) return;
    el.setPointerCapture(e.pointerId);
    st = { x: e.clientX, y: e.clientY, t: performance.now(), axis: null, vx: 0, vy: 0, lx: e.clientX, ly: e.clientY, lt: performance.now() };
    cb.press(local(e));
    st.timer = setTimeout(() => {
      if (st && !st.axis && cb.hold(true)) st.held = true;
    }, HOLD_MS);
  });

  el.addEventListener("pointermove", (e) => {
    if (!st) {
      if (e.pointerType === "mouse") cb.hover(local(e));
      return;
    }
    if (st.fired) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (!st.axis && Math.hypot(dx, dy) > AXIS_LOCK) {
      st.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      clearTimeout(st.timer);
      if (st.held) { st.held = false; cb.hold(false); }
    }

    // past the flip distance while still holding: flip right away and let go of the drag
    if (st.axis === "x" && Math.abs(dx) > FLIP_DIST) {
      st.fired = true;
      cb.trigger(dx < 0 ? "flipNext" : "flipPrev");
      return;
    }

    const now = performance.now();
    const dt = Math.max(1, now - st.lt);
    st.vx = 0.7 * st.vx + 0.3 * ((e.clientX - st.lx) / dt);
    st.vy = 0.7 * st.vy + 0.3 * ((e.clientY - st.ly) / dt);
    st.lx = e.clientX; st.ly = e.clientY; st.lt = now;

    cb.move({ dx, dy, axis: st.axis, ...local(e) });
  });

  const end = (e, cancelled) => {
    if (!st) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    const { axis, vx, vy, held, timer, fired } = st;
    st = null;
    clearTimeout(timer);
    if (held) cb.hold(false);

    let action = "none";
    if (!cancelled && !held && !fired) {
      if (Math.hypot(dx, dy) < TAP_MAX) action = "tap";
      else if (axis === "x" && (Math.abs(dx) > FLIP_DIST || Math.abs(vx) > FLICK_SPEED)) action = dx < 0 || vx < -FLICK_SPEED ? "flipNext" : "flipPrev";
      else if (axis === "y" && (Math.abs(dy) > GRADE_DIST || Math.abs(vy) > FLICK_SPEED)) action = dy < 0 || vy < -FLICK_SPEED ? "up" : "down";
    }
    const { px, py } = local(e);
    cb.release({ action, dx, dy, px, py });
  };

  el.addEventListener("contextmenu", (e) => e.preventDefault());
  el.addEventListener("pointerup", (e) => end(e, false));
  el.addEventListener("pointercancel", (e) => end(e, true));
  el.addEventListener("pointerleave", (e) => { if (!st && e.pointerType === "mouse") cb.hoverEnd(); });

  return { GRADE_DIST };
}
