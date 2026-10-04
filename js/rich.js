// Equations use KaTeX, loaded only for decks that ask for it. Write math as \( ... \) inline or \[ ... \] display.
const MATH = /(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g;
let loading = null;

export function mathReady() {
  if (window.katex) return Promise.resolve();
  loading ||= new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "vendor/katex/katex.min.css";
    document.head.append(css);
    const js = document.createElement("script");
    js.src = "vendor/katex/katex.min.js";
    js.onload = resolve;
    js.onerror = reject;
    document.head.append(js);
  });
  return loading;
}

// text length with each equation counted as a short word, for choosing a font size
export function plainLength(str = "") {
  return str.replace(MATH, "xxxx").length;
}

export function rich(el, str = "") {
  el.replaceChildren();
  if (!window.katex || !MATH.test(str)) { MATH.lastIndex = 0; el.textContent = str; return; }
  MATH.lastIndex = 0;
  for (const part of str.split(MATH)) {
    if (!part) continue;
    const display = part.startsWith("\\[");
    if (display || part.startsWith("\\(")) {
      const span = document.createElement(display ? "div" : "span");
      span.innerHTML = window.katex.renderToString(part.slice(2, -2), { displayMode: display, throwOnError: false });
      el.append(span);
    } else {
      el.append(part);
    }
  }
}
