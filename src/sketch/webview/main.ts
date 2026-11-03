import "./style.css";
import { fitScale, History, isDegenerate, normalizeSelection, topmostHit, type Point, type Rect, type Shape } from "../model";

type Tool = "select" | "pen" | "arrow" | "rect" | "text" | "eraser";

const TOOLS: { tool: Tool; icon: string; label: string; key: string }[] = [
  { tool: "select", icon: "⬚", label: "Select area to copy", key: "s" },
  { tool: "pen", icon: "✎", label: "Pen", key: "p" },
  { tool: "arrow", icon: "↗", label: "Arrow", key: "a" },
  { tool: "rect", icon: "▭", label: "Rectangle", key: "r" },
  { tool: "text", icon: "T", label: "Text", key: "t" },
  { tool: "eraser", icon: "⌫", label: "Eraser", key: "e" },
];
const COLORS = [
  { color: "#e5212b", label: "Red" },
  { color: "#ffd400", label: "Yellow" },
  { color: "#22c55e", label: "Green" },
  { color: "#2f80ed", label: "Blue" },
  { color: "#ffffff", label: "White" },
  { color: "#111111", label: "Black" },
];
/** Grubość linii i wielkość tekstu w pikselach ekranu. */
const WIDTHS = [
  { width: 2, text: 16, label: "Thin" },
  { width: 4, text: 22, label: "Medium" },
  { width: 8, text: 32, label: "Thick" },
];
const ERASER_REACH = 6;
const FONT = "sans-serif";

const state = {
  tool: "arrow" as Tool,
  color: COLORS[0].color,
  width: WIDTHS[1],
  scale: 1,
  draft: undefined as Shape | undefined,
  erasing: false,
  /** Obszar do skopiowania, w pikselach obrazu. */
  selection: undefined as Rect | undefined,
  selectFrom: undefined as Point | undefined,
};
const history = new History();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: Node[]) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// --- Układ -------------------------------------------------------------------

const toolbar = el("div", { id: "toolbar" });
const shot = el("img", { id: "shot", alt: "Browser screenshot", draggable: false });
const layer = el("canvas", { id: "layer" });
const frame = el("div", { id: "frame" }, shot, layer);
const stage = el("div", { id: "stage" }, frame);
const toast = el("div", { id: "toast" });
document.body.prepend(toolbar, stage, toast);
const ctx = layer.getContext("2d")!;

function group(...buttons: HTMLButtonElement[]) {
  toolbar.append(el("div", { className: "group" }, ...buttons));
}

const toolButtons = TOOLS.map((t) =>
  el("button", { title: `${t.label} (${t.key.toUpperCase()})`, textContent: t.icon, onclick: () => setTool(t.tool) }),
);
const colorButtons = COLORS.map((c) => {
  const b = el("button", { className: "swatch", title: c.label, onclick: () => setColor(c.color) });
  b.style.background = c.color;
  return b;
});
const widthButtons = WIDTHS.map((w) => {
  const dot = el("span", { className: "width-dot" });
  dot.style.width = dot.style.height = `${w.width + 2}px`;
  return el("button", { title: w.label, onclick: () => setWidth(w) }, dot);
});
const undoButton = el("button", { title: "Undo (Ctrl+Z)", textContent: "↶", onclick: () => undo() });
const redoButton = el("button", { title: "Redo (Ctrl+Shift+Z)", textContent: "↷", onclick: () => redo() });
group(...toolButtons);
group(...colorButtons);
group(...widthButtons);
const copyButton = el("button", {
  title: "Copy to clipboard (Ctrl+C) — selection or whole image",
  textContent: "⧉ Copy",
  onclick: () => copyImage(),
});
group(undoButton, redoButton);
group(copyButton);

function refreshToolbar() {
  toolButtons.forEach((b, i) => b.classList.toggle("active", TOOLS[i].tool === state.tool));
  colorButtons.forEach((b, i) => b.classList.toggle("active", COLORS[i].color === state.color));
  widthButtons.forEach((b, i) => b.classList.toggle("active", WIDTHS[i] === state.width));
  undoButton.disabled = !history.canUndo;
  redoButton.disabled = !history.canRedo;
  layer.className = state.tool === "eraser" ? "eraser" : state.tool === "text" ? "text" : "";
}

function setTool(tool: Tool) {
  commitText();
  state.tool = tool;
  refreshToolbar();
}
function setColor(color: string) {
  state.color = color;
  if (textInput) textInput.style.color = color;
  refreshToolbar();
}
function setWidth(width: (typeof WIDTHS)[number]) {
  state.width = width;
  refreshToolbar();
}

// --- Dopasowanie obrazu do karty ---------------------------------------------

function layout() {
  if (!shot.naturalWidth) return;
  commitText();
  const dpr = window.devicePixelRatio || 1;
  const img = { w: shot.naturalWidth, h: shot.naturalHeight };
  state.scale = fitScale(img, { w: stage.clientWidth - 16, h: stage.clientHeight - 16 }, dpr);
  const cssW = img.w * state.scale;
  const cssH = img.h * state.scale;
  shot.style.width = layer.style.width = `${cssW}px`;
  shot.style.height = layer.style.height = `${cssH}px`;
  layer.width = Math.round(cssW * dpr);
  layer.height = Math.round(cssH * dpr);
  render();
}

shot.addEventListener("load", layout);
new ResizeObserver(layout).observe(stage);
shot.src = document.body.dataset.image ?? "";

// --- Rysowanie ---------------------------------------------------------------

function contrast(color: string): string {
  const n = parseInt(color.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 140 ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.85)";
}

function draw(g: CanvasRenderingContext2D, s: Shape) {
  g.strokeStyle = g.fillStyle = s.color;
  g.lineCap = g.lineJoin = "round";
  switch (s.kind) {
    case "pen":
      g.lineWidth = s.width;
      g.beginPath();
      s.points.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
      break;
    case "rect":
      g.lineWidth = s.width;
      g.strokeRect(s.from.x, s.from.y, s.to.x - s.from.x, s.to.y - s.from.y);
      break;
    case "arrow": {
      const angle = Math.atan2(s.to.y - s.from.y, s.to.x - s.from.x);
      const len = Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
      const head = Math.min(Math.max(12 / state.scale, s.width * 4), len * 0.6);
      const base = { x: s.to.x - head * 0.8 * Math.cos(angle), y: s.to.y - head * 0.8 * Math.sin(angle) };
      g.lineWidth = s.width;
      g.beginPath();
      g.moveTo(s.from.x, s.from.y);
      g.lineTo(base.x, base.y);
      g.stroke();
      g.beginPath();
      g.moveTo(s.to.x, s.to.y);
      g.lineTo(s.to.x - head * Math.cos(angle - 0.45), s.to.y - head * Math.sin(angle - 0.45));
      g.lineTo(s.to.x - head * Math.cos(angle + 0.45), s.to.y - head * Math.sin(angle + 0.45));
      g.closePath();
      g.fill();
      break;
    }
    case "text":
      g.font = `${s.size}px ${FONT}`;
      g.textBaseline = "top";
      g.lineWidth = s.size / 6;
      g.strokeStyle = contrast(s.color);
      g.strokeText(s.text, s.at.x, s.at.y);
      g.fillText(s.text, s.at.x, s.at.y);
      break;
  }
}

function render() {
  const k = state.scale * (window.devicePixelRatio || 1);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, layer.width, layer.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  history.shapes.forEach((s) => draw(ctx, s));
  if (state.draft) draw(ctx, state.draft);
  drawSelection();
  refreshToolbar();
}

/** Przyciemnia wszystko poza zaznaczeniem — tylko na ekranie, nie w kopii. */
function drawSelection() {
  const sel = state.selection;
  if (!sel) return;
  const w = shot.naturalWidth;
  const h = shot.naturalHeight;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.rect(sel.x, sel.y, sel.w, sel.h);
  ctx.fill("evenodd");
  ctx.lineWidth = 1 / state.scale;
  ctx.setLineDash([6 / state.scale, 4 / state.scale]);
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(sel.x, sel.y, sel.w, sel.h);
  ctx.restore();
}

function toImage(e: PointerEvent): Point {
  return { x: e.offsetX / state.scale, y: e.offsetY / state.scale };
}

function eraseAt(p: Point) {
  const hit = topmostHit(history.shapes, p, ERASER_REACH / state.scale);
  if (hit) {
    history.remove(hit);
    render();
  }
}

layer.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  const p = toImage(e);
  const width = state.width.width / state.scale;
  switch (state.tool) {
    case "text":
      // Bez tego domyślna obsługa kliknięcia zabiera fokus nowemu polu tekstu.
      e.preventDefault();
      if (textInput) commitText();
      else openTextInput(p, e.offsetX, e.offsetY);
      return;
    case "select":
      state.selectFrom = p;
      state.selection = undefined;
      render();
      break;
    case "eraser":
      state.erasing = true;
      eraseAt(p);
      break;
    case "pen":
      state.draft = { kind: "pen", points: [p], color: state.color, width };
      break;
    case "arrow":
    case "rect":
      state.draft = { kind: state.tool, from: p, to: p, color: state.color, width };
      break;
  }
  layer.setPointerCapture(e.pointerId);
});

layer.addEventListener("pointermove", (e) => {
  const p = toImage(e);
  if (state.erasing) return eraseAt(p);
  if (state.selectFrom) {
    state.selection = normalizeSelection(state.selectFrom, p, { w: shot.naturalWidth, h: shot.naturalHeight });
    return render();
  }
  const d = state.draft;
  if (!d) return;
  if (d.kind === "pen") d.points.push(p);
  else if (d.kind === "arrow" || d.kind === "rect") d.to = p;
  render();
});

function endStroke() {
  state.erasing = false;
  state.selectFrom = undefined;
  const d = state.draft;
  state.draft = undefined;
  if (d && !isDegenerate(d)) history.add(d);
  render();
}
layer.addEventListener("pointerup", endStroke);
layer.addEventListener("pointercancel", endStroke);

// --- Tekst -------------------------------------------------------------------

let textInput: HTMLInputElement | undefined;
let textAt: Point | undefined;

function openTextInput(at: Point, cssX: number, cssY: number) {
  const size = state.width.text;
  textAt = at;
  textInput = document.createElement("input");
  textInput.id = "text-input";
  textInput.spellcheck = false;
  textInput.style.left = `${cssX}px`;
  textInput.style.top = `${cssY}px`;
  textInput.style.fontSize = `${size}px`;
  textInput.style.color = state.color;
  textInput.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") commitText();
    else if (e.key === "Escape") closeTextInput();
  });
  textInput.addEventListener("input", () => {
    textInput!.style.width = `${Math.max(2, textInput!.value.length + 1)}ch`;
  });
  textInput.addEventListener("blur", () => commitText());
  frame.append(textInput);
  setTimeout(() => textInput?.focus());
}

function closeTextInput() {
  const input = textInput;
  textInput = undefined;
  textAt = undefined;
  input?.remove();
}

function commitText() {
  if (!textInput || !textAt) return;
  const size = state.width.text / state.scale;
  ctx.font = `${size}px ${FONT}`;
  const shape: Shape = {
    kind: "text",
    at: textAt,
    text: textInput.value,
    color: state.color,
    size,
    boxWidth: ctx.measureText(textInput.value).width,
  };
  closeTextInput();
  if (!isDegenerate(shape)) history.add(shape);
  render();
}

// --- Kopiowanie do schowka ---------------------------------------------------

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function showToast(text: string, error = false) {
  toast.textContent = text;
  toast.className = error ? "visible error" : "visible";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.className = ""), error ? 6000 : 1800);
}

/** Zaznaczony obszar (albo cały obraz) z rysunkiem, w pełnej rozdzielczości zrzutu. */
function renderExport(): Promise<Blob> {
  commitText();
  const area = state.selection ?? { x: 0, y: 0, w: shot.naturalWidth, h: shot.naturalHeight };
  const out = document.createElement("canvas");
  out.width = area.w;
  out.height = area.h;
  const g = out.getContext("2d")!;
  g.translate(-area.x, -area.y);
  g.drawImage(shot, 0, 0);
  history.shapes.forEach((s) => draw(g, s));
  return new Promise((resolve, reject) =>
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image"))), "image/png"),
  );
}

async function copyImage() {
  if (!shot.naturalWidth) return;
  try {
    // Obietnica w ClipboardItem: zapis zaczyna się jeszcze w geście użytkownika.
    await navigator.clipboard.write([new ClipboardItem({ "image/png": renderExport() })]);
    showToast(state.selection ? "Selection copied" : "Image copied");
  } catch (err) {
    showToast(`Copy failed: ${err instanceof Error ? err.message : String(err)}`, true);
  }
}

// --- Cofanie i skróty --------------------------------------------------------

function undo() {
  if (history.undo()) render();
}
function redo() {
  if (history.redo()) render();
}

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod && key === "c") {
    e.preventDefault();
    void copyImage();
  } else if (!mod && key === "enter" && state.selection) {
    e.preventDefault();
    void copyImage();
  } else if (key === "escape" && state.selection) {
    state.selection = undefined;
    render();
  } else if (mod && key === "z") {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  } else if (mod && key === "y") {
    e.preventDefault();
    redo();
  } else if (!mod && !e.altKey) {
    const t = TOOLS.find((t) => t.key === key);
    if (t) setTool(t.tool);
  }
});

refreshToolbar();
