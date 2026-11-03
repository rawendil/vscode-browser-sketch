/** Longer side an SVG is rendered at, at least — small icons would otherwise be a speck in the sketch tab. */
const MIN_LONGER_SIDE = 2048;

/**
 * Pixel size to render an SVG at, read the way a browser would: width/height, else the viewBox,
 * else 300×150. Scaled up so the longer side is at least MIN_LONGER_SIDE.
 */
export function svgRasterSize(text: string): { w: number; h: number } {
  const root = text.replace(/<!--[\s\S]*?-->/g, "").match(/<svg\b[^>]*>/i)?.[0] ?? "";
  const attr = (name: string) => root.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
  const box = attr("viewBox")?.trim().split(/[\s,]+/).map(Number);
  const vb = box?.length === 4 && box[2] > 0 && box[3] > 0 ? { w: box[2], h: box[3] } : undefined;
  let w = length(attr("width"));
  let h = length(attr("height"));
  if (vb && w && !h) h = (w * vb.h) / vb.w;
  if (vb && h && !w) w = (h * vb.w) / vb.h;
  if (!w || !h) ({ w, h } = vb ?? { w: 300, h: 150 });
  const k = Math.max(1, MIN_LONGER_SIDE / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

/** An SVG length in px; units we cannot resolve without a layout (%, em) give `undefined`. */
function length(value: string | undefined): number | undefined {
  const m = value?.trim().match(/^([\d.]+)(px|pt)?$/i);
  const n = m ? Number(m[1]) * (m[2]?.toLowerCase() === "pt" ? 4 / 3 : 1) : NaN;
  return n > 0 ? n : undefined;
}
