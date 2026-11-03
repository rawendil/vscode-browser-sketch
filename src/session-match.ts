/** Key in the debug configuration by which we recognize our own root session. */
export const MARKER_KEY = "__browserSketchId";

export interface SessionLike {
  id: string;
  type: string;
  configuration: Record<string, unknown>;
  parentSession?: SessionLike;
}

/**
 * Configuration for attaching to a built-in browser tab. js-debug skips the picker
 * only when `urlFilter` matches exactly one tab — `*` matches any.
 */
export function attachConfig(marker: string) {
  return {
    type: "editor-browser",
    request: "attach",
    name: "Browser Sketch",
    urlFilter: "*",
    internalConsoleOptions: "neverOpen",
    [MARKER_KEY]: marker,
  };
}

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${ms} ms`);
    this.name = "TimeoutError";
  }
}

/** The user did not pick a tab (picker closed or timed out) — we finish silently. */
export class AttachCancelledError extends Error {
  constructor() {
    super("No browser tab selected");
    this.name = "AttachCancelledError";
  }
}

export function isOwnSession(session: SessionLike, marker: string): boolean {
  return session.configuration[MARKER_KEY] === marker;
}

/** Child session (page) started by our root session — never someone else's. */
export function isOwnChild(session: SessionLike, marker: string): boolean {
  return !!session.parentSession && isOwnSession(session.parentSession, marker);
}

export function waitFor<T>(
  subscribe: (cb: (v: T) => void) => { dispose(): void },
  predicate: (v: T) => boolean,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const subscription = subscribe((v) => {
      if (!predicate(v)) return;
      clearTimeout(timer);
      subscription.dispose();
      resolve(v);
    });
    const timer = setTimeout(() => {
      subscription.dispose();
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);
  });
}

export function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(timeoutMs)), timeoutMs);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
