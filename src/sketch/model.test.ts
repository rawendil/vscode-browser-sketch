import { describe, expect, test } from "vitest";
import { fitScale, hitTest, History, isDegenerate, normalizeSelection, topmostHit, type Shape } from "./model";

const red = "#e5212b";
const arrow = (x1: number, y1: number, x2: number, y2: number): Shape => ({
  kind: "arrow",
  from: { x: x1, y: y1 },
  to: { x: x2, y: y2 },
  color: red,
  width: 4,
});
const rect = (x1: number, y1: number, x2: number, y2: number): Shape => ({
  kind: "rect",
  from: { x: x1, y: y1 },
  to: { x: x2, y: y2 },
  color: red,
  width: 4,
});

describe("History", () => {
  test("add, undo and redo", () => {
    const h = new History();
    const a = arrow(0, 0, 10, 10);
    h.add(a);
    expect(h.shapes).toEqual([a]);
    expect(h.undo()).toBe(true);
    expect(h.shapes).toEqual([]);
    expect(h.redo()).toBe(true);
    expect(h.shapes).toEqual([a]);
  });

  test("undoing an erase restores the shape at the same position in the order", () => {
    const h = new History();
    const [a, b, c] = [arrow(0, 0, 10, 0), arrow(0, 10, 10, 10), arrow(0, 20, 10, 20)];
    h.add(a);
    h.add(b);
    h.add(c);
    h.remove(b);
    expect(h.shapes).toEqual([a, c]);
    h.undo();
    expect(h.shapes).toEqual([a, b, c]);
    h.redo();
    expect(h.shapes).toEqual([a, c]);
  });

  test("a new action after undo clears redo", () => {
    const h = new History();
    h.add(arrow(0, 0, 10, 0));
    h.undo();
    h.add(rect(0, 0, 10, 10));
    expect(h.canRedo).toBe(false);
    expect(h.redo()).toBe(false);
  });

  test("undo on empty history does nothing", () => {
    const h = new History();
    expect(h.canUndo).toBe(false);
    expect(h.undo()).toBe(false);
  });
});

describe("hitTest", () => {
  test("pen: hit near a segment, missed far away", () => {
    const pen: Shape = { kind: "pen", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], color: red, width: 4 };
    expect(hitTest(pen, { x: 50, y: 3 }, 5)).toBe(true);
    expect(hitTest(pen, { x: 50, y: 20 }, 5)).toBe(false);
  });

  test("arrow: hit near the segment", () => {
    expect(hitTest(arrow(0, 0, 100, 100), { x: 52, y: 48 }, 5)).toBe(true);
    expect(hitTest(arrow(0, 0, 100, 100), { x: 80, y: 20 }, 5)).toBe(false);
  });

  test("rectangle: hit at the edge, not in the middle", () => {
    const r = rect(100, 100, 0, 0);
    expect(hitTest(r, { x: 2, y: 50 }, 5)).toBe(true);
    expect(hitTest(r, { x: 50, y: 50 }, 5)).toBe(false);
  });

  test("text: hit inside the box", () => {
    const t: Shape = { kind: "text", at: { x: 10, y: 10 }, text: "tu", color: red, size: 20, boxWidth: 30 };
    expect(hitTest(t, { x: 20, y: 20 }, 0)).toBe(true);
    expect(hitTest(t, { x: 60, y: 20 }, 0)).toBe(false);
  });

  test("topmostHit returns the most recently drawn", () => {
    const [a, b] = [arrow(0, 0, 100, 0), arrow(0, 0, 100, 0)];
    expect(topmostHit([a, b], { x: 50, y: 0 }, 5)).toBe(b);
    expect(topmostHit([a, b], { x: 50, y: 50 }, 5)).toBeUndefined();
  });
});

describe("isDegenerate", () => {
  test("a click without dragging for arrow and rectangle", () => {
    expect(isDegenerate(arrow(10, 10, 11, 11))).toBe(true);
    expect(isDegenerate(rect(10, 10, 12, 10))).toBe(true);
    expect(isDegenerate(arrow(10, 10, 30, 10))).toBe(false);
  });

  test("pen with a single point and empty text", () => {
    expect(isDegenerate({ kind: "pen", points: [{ x: 1, y: 1 }], color: red, width: 2 })).toBe(true);
    expect(isDegenerate({ kind: "text", at: { x: 0, y: 0 }, text: "  ", color: red, size: 20, boxWidth: 0 })).toBe(true);
  });
});

describe("fitScale", () => {
  test("a smaller image is not scaled up beyond screen pixels", () => {
    expect(fitScale({ w: 800, h: 400 }, { w: 2000, h: 2000 }, 2)).toBe(0.5);
  });

  test("a larger image fitted to the tighter dimension", () => {
    expect(fitScale({ w: 2000, h: 1000 }, { w: 1000, h: 1000 }, 1)).toBe(0.5);
    expect(fitScale({ w: 1000, h: 2000 }, { w: 1000, h: 500 }, 1)).toBe(0.25);
  });
});

describe("normalizeSelection", () => {
  const img = { w: 1000, h: 500 };

  test("orders corners regardless of drag direction and rounds to pixels", () => {
    expect(normalizeSelection({ x: 300.6, y: 200.2 }, { x: 100.2, y: 50.7 }, img)).toEqual({ x: 100, y: 50, w: 201, h: 151 });
  });

  test("clamps to the image edges", () => {
    expect(normalizeSelection({ x: -50, y: -20 }, { x: 1200, y: 100 }, img)).toEqual({ x: 0, y: 0, w: 1000, h: 100 });
  });

  test("a too-small selection (click) means no selection", () => {
    expect(normalizeSelection({ x: 10, y: 10 }, { x: 11, y: 40 }, img)).toBeUndefined();
  });

  test("a selection entirely outside the image means no selection", () => {
    expect(normalizeSelection({ x: 1100, y: 10 }, { x: 1200, y: 40 }, img)).toBeUndefined();
  });
});
