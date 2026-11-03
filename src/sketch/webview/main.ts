import "./style.css";
import { fitScale, History, isDegenerate, topmostHit, type Point, type Shape } from "../model";

type Tool = "pen" | "arrow" | "rect" | "text" | "eraser";

const TOOLS: { tool: Tool; icon: string; label: string; key: string }[] = [
  { tool: "pen", icon: "✎", label: "Pisak", key: "p" },
  { tool: "arrow", icon: "↗", label: "Strzałka", key: "a" },
  { tool: "rect", icon: "▭", label: "Prostokąt", key: "r" },
  { tool: "text", icon: "T", label: "Tekst", key: "t" },
  { tool: "eraser", icon: "⌫", label: "Gumka", key: "e" },
];
const COLORS = [
  { color: "#e5212b", label: "Czerwony" },
  { color: "#ffd400", label: "Żółty" },
  { color: "#22c55e", label: "Zielony" },
  { color: "#2f80ed", label: "Niebieski" },
  { color: "#ffffff", label: "Biały" },
  { color: "#111111", label: "Czarny" },
];
/** Grubość linii i wielkość tekstu w pikselach ekranu. */
const WIDTHS = [
  { width: 2, text: 16, label: "Cienka" },
  { width: 4, text: 22, label: "Średnia" },
  { width: 8, text: 32, label: "Gruba" },
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
};
const history = new History();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: Node[]) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// --- Układ -------------------------------------------------------------------

const toolbar = el("div", { id: "toolbar" });
const shot = el("img", { id: "shot", alt: "Zrzut przeglądarki", draggable: false });
const layer = el("canvas", { id: "layer" });
const frame = el("div", { id: "frame" }, shot, layer);
const stage = el("div", { id: "stage" }, frame);
document.body.prepend(toolbar, stage);
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
const undoButton = el("button", { title: "Cofnij (Ctrl+Z)", textContent: "↶", onclick: () => undo() });
const redoButton = el("button", { title: "Ponów (Ctrl+Shift+Z)", textContent: "↷", onclick: () => redo() });
group(...toolButtons);
group(...colorButtons);
group(...widthButtons);
group(undoButton, redoButton);

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

function draw(s: Shape) {
  ctx.strokeStyle = ctx.fillStyle = s.color;
  ctx.lineCap = ctx.lineJoin = "round";
  switch (s.kind) {
    case "pen":
      ctx.lineWidth = s.width;
      ctx.beginPath();
      s.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      break;
    case "rect":
      ctx.lineWidth = s.width;
      ctx.strokeRect(s.from.x, s.from.y, s.to.x - s.from.x, s.to.y - s.from.y);
      break;
    case "arrow": {
      const angle = Math.atan2(s.to.y - s.from.y, s.to.x - s.from.x);
      const len = Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
      const head = Math.min(Math.max(12 / state.scale, s.width * 4), len * 0.6);
      const base = { x: s.to.x - head * 0.8 * Math.cos(angle), y: s.to.y - head * 0.8 * Math.sin(angle) };
      ctx.lineWidth = s.width;
      ctx.beginPath();
      ctx.moveTo(s.from.x, s.from.y);
      ctx.lineTo(base.x, base.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s.to.x, s.to.y);
      ctx.lineTo(s.to.x - head * Math.cos(angle - 0.45), s.to.y - head * Math.sin(angle - 0.45));
      ctx.lineTo(s.to.x - head * Math.cos(angle + 0.45), s.to.y - head * Math.sin(angle + 0.45));
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "text":
      ctx.font = `${s.size}px ${FONT}`;
      ctx.textBaseline = "top";
      ctx.lineWidth = s.size / 6;
      ctx.strokeStyle = contrast(s.color);
      ctx.strokeText(s.text, s.at.x, s.at.y);
      ctx.fillText(s.text, s.at.x, s.at.y);
      break;
  }
}

function render() {
  const k = state.scale * (window.devicePixelRatio || 1);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, layer.width, layer.height);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  history.shapes.forEach(draw);
  if (state.draft) draw(state.draft);
  refreshToolbar();
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
  const d = state.draft;
  if (!d) return;
  if (d.kind === "pen") d.points.push(p);
  else if (d.kind === "arrow" || d.kind === "rect") d.to = p;
  render();
});

function endStroke() {
  state.erasing = false;
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
  if (mod && key === "z") {
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
