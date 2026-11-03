import { afterEach, describe, expect, test, vi } from "vitest";
import { attachConfig, isOwnChild, MARKER_KEY, TimeoutError, waitFor, withTimeout, type SessionLike } from "./session-match";

function session(id: string, configuration: Record<string, unknown>, parentSession?: SessionLike): SessionLike {
  return { id, type: "editor-browser", configuration, parentSession };
}

describe("isOwnChild", () => {
  const ourRoot = session("R1", { [MARKER_KEY]: "m1" });

  test("true dla potomnej z naszym znacznikiem u rodzica", () => {
    expect(isOwnChild(session("C1", {}, ourRoot), "m1")).toBe(true);
  });

  test("false dla sesji głównej (bez rodzica), nawet z naszym znacznikiem", () => {
    expect(isOwnChild(ourRoot, "m1")).toBe(false);
  });

  test("false dla potomnej cudzej sesji (inny znacznik albo brak)", () => {
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

  test("zwraca pierwszą wartość spełniającą warunek i woła dispose", async () => {
    const e = emitter<number>();
    const p = waitFor(e.subscribe, (v) => v > 1, 1000);
    e.emit(1);
    e.emit(2);
    e.emit(3);
    expect(await p).toBe(2);
    expect(e.dispose).toHaveBeenCalled();
  });

  test("odrzuca po limicie czasu i woła dispose", async () => {
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

  test("przepuszcza wynik, który zdążył", async () => {
    expect(await withTimeout(Promise.resolve(7), 1000)).toBe(7);
  });

  test("odrzuca TimeoutError, gdy obietnica wisi", async () => {
    vi.useFakeTimers();
    const p = withTimeout(new Promise(() => {}), 1000);
    vi.advanceTimersByTime(1000);
    await expect(p).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe("attachConfig", () => {
  test("attach do editor-browser ze znacznikiem i urlFilter '*' (jedna karta bez okna wyboru)", () => {
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
