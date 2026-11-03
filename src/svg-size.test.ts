import { describe, expect, test } from "vitest";
import { svgRasterSize } from "./svg-size";

const svg = (attrs: string) => `<?xml version="1.0"?>\n<!-- <svg width="1"> -->\n<svg xmlns="http://www.w3.org/2000/svg" ${attrs}><rect/></svg>`;

describe("svgRasterSize", () => {
  test("width and height win, small images are scaled up to 2048 on the longer side", () => {
    expect(svgRasterSize(svg(`width="128" height="64" viewBox="0 0 10 10"`))).toEqual({ w: 2048, h: 1024 });
  });

  test("px and pt units", () => {
    expect(svgRasterSize(svg(`width="3000px" height="1500px"`))).toEqual({ w: 3000, h: 1500 });
    expect(svgRasterSize(svg(`width="1536pt" height="768pt"`))).toEqual({ w: 2048, h: 1024 });
  });

  test("viewBox only (common for icons)", () => {
    expect(svgRasterSize(svg(`viewBox="0 0 24 12"`))).toEqual({ w: 2048, h: 1024 });
  });

  test("one dimension plus viewBox keeps the viewBox aspect ratio", () => {
    expect(svgRasterSize(svg(`width="100" viewBox="0,0,200,50"`))).toEqual({ w: 2048, h: 512 });
  });

  test("percentages or nothing fall back to the browser default 300×150", () => {
    expect(svgRasterSize(svg(`width="100%" height="100%"`))).toEqual({ w: 2048, h: 1024 });
    expect(svgRasterSize("not an svg")).toEqual({ w: 2048, h: 1024 });
  });

  test("large images keep their size", () => {
    expect(svgRasterSize(svg(`width="4000" height="1000"`))).toEqual({ w: 4000, h: 1000 });
  });
});
