import { afterEach, describe, expect, test, vi } from "vitest";
import { attachConfig, isOwnChild, MARKER_KEY, TimeoutError, waitFor, withTimeout, type SessionLike } from "./session-match";

function session(id: string, configuration: Record<string, unknown>, parentSession?: SessionLike): SessionLike {
  return { id, type: "editor-browser", configuration, parentSession };
}

describe("isOwnChild", () => {
  const ourRoot = session("R1", { [MARKER_KEY]: "m1" });

  test("true for a child with our marker on its parent", () => {
    expect(isOwnChild(session("C1", {}, ourRoot), "m1")).toBe(true);
  });

  test("false for a root session (no parent), even with our marker", () => {
    expect(isOwnChild(ourRoot, "m1")).toBe(false);
  });

  test("false for a child of someone else's session (different marker or none)", () => {
    expect(isOwnChild(session("C2", {}, session("R2", { [MARKER_KEY]: "m2" })), "m1")).toBe(false);
    expect(isOwnChild(session("C3", {}, session("R3", {})), "m1")).toBe(false);
  });
});

describe("waitFor", () => {
  afterEach(() => vi.useRealTimers());

  function emitter<T>() {
    let listener: ((v: T) => void) | undefined;
    const dispose = vi.fn(() => (listener = undefined));
    return {
      subscribe: (cb: (v: T) => void) => ((listener = cb), { dispose }),
      emit: (v: T) => listener?.(v),
      dispose,
    };
  }

  test("returns the first value that satisfies the condition and calls dispose", async () => {
    const e = emitter<number>();
    const p = waitFor(e.subscribe, (v) => v > 1, 1000);
    e.emit(1);
    e.emit(2);
    e.emit(3);
    expect(await p).toBe(2);
    expect(e.dispose).toHaveBeenCalled();
  });

  test("rejects after the timeout and calls dispose", async () => {
    vi.useFakeTimers();
    const e = emitter<number>();
    const p = waitFor(e.subscribe, () => true, 1000);
    vi.advanceTimersByTime(1000);
    await expect(p).rejects.toThrow();
    expect(e.dispose).toHaveBeenCalled();
  });
});

describe("withTimeout", () => {
  afterEach(() => vi.useRealTimers());

  test("passes through a result that arrived in time", async () => {
    expect(await withTimeout(Promise.resolve(7), 1000)).toBe(7);
  });

  test("rejects with TimeoutError when the promise hangs", async () => {
    vi.useFakeTimers();
    const p = withTimeout(new Promise(() => {}), 1000);
    vi.advanceTimersByTime(1000);
    await expect(p).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe("attachConfig", () => {
  test("attach to editor-browser with marker and urlFilter '*' (single tab without the picker)", () => {
    expect(attachConfig("m1")).toEqual({
      type: "editor-browser",
      request: "attach",
      name: "Browser Sketch",
      urlFilter: "*",
      internalConsoleOptions: "neverOpen",
      [MARKER_KEY]: "m1",
    });
  });
});
