document.documentElement.classList.add("finn-darkmode");

// Page-level CSS can't reach into shadow roots (FINN's web components render
// their images there), so re-invert media inside each shadow root as well.
//
// Empty elements with a CSS background image (e.g. category cards) are tagged
// with BG_ATTR. Their image layer is moved to a re-inverted ::before, while any
// gradient layer moves to ::after and stays inverted so overlaid text remains
// readable. dark.css contains the same rules for the light DOM.
const BG_ATTR = "data-finn-dark-bg";
const FLIP = "invert(1) hue-rotate(180deg)";
const SHADOW_CSS = `
img, video, canvas { filter: ${FLIP} !important; }
[${BG_ATTR}] { background-image: none !important; }
[${BG_ATTR}]::before, [${BG_ATTR}]::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background-size: inherit; background-position: inherit; background-repeat: inherit;
}
[${BG_ATTR}]::before { background-image: var(--finn-bg-url, none); filter: ${FLIP}; }
[${BG_ATTR}]::after { background-image: var(--finn-bg-grad, none); }
`;
const seenRoots = new WeakSet();
const MEDIA_TAGS = new Set(["IMG", "VIDEO", "CANVAS", "SVG", "STYLE", "SCRIPT"]);

function splitLayers(value) {
  const layers = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (quote) {
      if (c === quote) quote = "";
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === "(") {
      depth++;
    } else if (c === ")") {
      depth--;
    } else if (c === "," && depth === 0) {
      layers.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  layers.push(value.slice(start).trim());
  return layers;
}

function markBackgroundImage(el) {
  if (
    el.hasAttribute(BG_ATTR) ||
    MEDIA_TAGS.has(el.tagName.toUpperCase()) ||
    el.children.length ||
    el.textContent.trim()
  ) {
    return;
  }
  const cs = getComputedStyle(el);
  if (!cs.backgroundImage.includes("url(")) return;

  const layers = splitLayers(cs.backgroundImage);
  const urls = layers.filter((l) => l.startsWith("url("));
  const others = layers.filter((l) => !l.startsWith("url(") && l !== "none");
  el.style.setProperty("--finn-bg-url", urls.join(", "));
  if (others.length) el.style.setProperty("--finn-bg-grad", others.join(", "));
  if (cs.position === "static") el.style.setProperty("position", "relative");
  el.setAttribute(BG_ATTR, "");
}

function handleElement(el) {
  const sr = getShadowRoot(el);
  if (sr) processRoot(sr);
  markBackgroundImage(el);
}

function getShadowRoot(el) {
  return el.openOrClosedShadowRoot || el.shadowRoot || null;
}

function processRoot(root) {
  if (seenRoots.has(root)) return;
  seenRoots.add(root);

  const style = document.createElement("style");
  style.textContent = SHADOW_CSS;
  root.appendChild(style);

  scan(root);
  observe(root);
}

function scan(node) {
  if (node.nodeType === Node.ELEMENT_NODE) {
    handleElement(node);
  } else if (
    node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE &&
    node.nodeType !== Node.DOCUMENT_NODE
  ) {
    return;
  }
  node.querySelectorAll("*").forEach(handleElement);
}

function observe(root) {
  new MutationObserver((mutations) => {
    for (const m of mutations) m.addedNodes.forEach(scan);
  }).observe(root, { childList: true, subtree: true });
}

observe(document);
document.addEventListener("DOMContentLoaded", () => scan(document));
window.addEventListener("load", () => scan(document));