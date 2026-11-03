/** Rysunek nad zrzutem: lista obiektów we współrzędnych pikseli obrazu. */

export type Point = { x: number; y: number };

export type Shape =
  | { kind: "pen"; points: Point[]; color: string; width: number }
  | { kind: "arrow"; from: Point; to: Point; color: string; width: number }
  | { kind: "rect"; from: Point; to: Point; color: string; width: number }
  | { kind: "text"; at: Point; text: string; color: string; size: number; boxWidth: number };

type Action = { type: "add"; shape: Shape } | { type: "remove"; shape: Shape; index: number };

export class History {
  private list: Shape[] = [];
  private done: Action[] = [];
  private undone: Action[] = [];

  get shapes(): readonly Shape[] {
    return this.list;
  }
  get canUndo(): boolean {
    return this.done.length > 0;
  }
  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  add(shape: Shape): void {
    this.apply({ type: "add", shape });
    this.undone = [];
  }

  remove(shape: Shape): void {
    const index = this.list.indexOf(shape);
    if (index < 0) return;
    this.apply({ type: "remove", shape, index });
    this.undone = [];
  }

  undo(): boolean {
    const action = this.done.pop();
    if (!action) return false;
    if (action.type === "add") this.list.splice(this.list.lastIndexOf(action.shape), 1);
    else this.list.splice(action.index, 0, action.shape);
    this.undone.push(action);
    return true;
  }

  redo(): boolean {
    const action = this.undone.pop();
    if (!action) return false;
    this.apply(action);
    return true;
  }

  private apply(action: Action): void {
    if (action.type === "add") this.list.push(action.shape);
    else this.list.splice(action.index, 1);
    this.done.push(action);
  }
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function rectCorners(from: Point, to: Point): Point[] {
  return [from, { x: to.x, y: from.y }, to, { x: from.x, y: to.y }];
}

export function hitTest(shape: Shape, p: Point, tolerance: number): boolean {
  switch (shape.kind) {
    case "pen": {
      const reach = tolerance + shape.width / 2;
      if (shape.points.length === 1) return Math.hypot(p.x - shape.points[0].x, p.y - shape.points[0].y) <= reach;
      return shape.points.some((a, i) => i > 0 && distToSegment(p, shape.points[i - 1], a) <= reach);
    }
    case "arrow":
      return distToSegment(p, shape.from, shape.to) <= tolerance + shape.width / 2;
    case "rect": {
      const c = rectCorners(shape.from, shape.to);
      return c.some((a, i) => distToSegment(p, a, c[(i + 1) % 4]) <= tolerance + shape.width / 2);
    }
    case "text":
      return (
        p.x >= shape.at.x - tolerance &&
        p.x <= shape.at.x + shape.boxWidth + tolerance &&
        p.y >= shape.at.y - tolerance &&
        p.y <= shape.at.y + shape.size * 1.2 + tolerance
      );
  }
}

export function topmostHit(shapes: readonly Shape[], p: Point, tolerance: number): Shape | undefined {
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (hitTest(shapes[i], p, tolerance)) return shapes[i];
  }
  return undefined;
}

/** Klik bez przeciągnięcia nie zostawia niewidzialnych obiektów. */
export function isDegenerate(shape: Shape): boolean {
  switch (shape.kind) {
    case "pen":
      return shape.points.length < 2;
    case "arrow":
      return Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y) < 3;
    case "rect":
      return Math.abs(shape.to.x - shape.from.x) < 3 || Math.abs(shape.to.y - shape.from.y) < 3;
    case "text":
      return shape.text.trim() === "";
  }
}

/** Skala obrazu w karcie: całość mieści się w ramce i nigdy powyżej 1:1 w pikselach ekranu. */
export function fitScale(img: { w: number; h: number }, box: { w: number; h: number }, dpr: number): number {
  return Math.min(box.w / img.w, box.h / img.h, 1 / dpr);
}
