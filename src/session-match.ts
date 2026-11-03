/** Klucz w konfiguracji debugowania, po którym rozpoznajemy własną sesję główną. */
export const MARKER_KEY = "__browserSketchId";

export interface SessionLike {
  id: string;
  type: string;
  configuration: Record<string, unknown>;
  parentSession?: SessionLike;
}

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Przekroczono limit czasu (${ms} ms)`);
    this.name = "TimeoutError";
  }
}

/** Użytkownik nie wybrał karty (zamknięty wybór albo minął czas) — kończymy po cichu. */
export class AttachCancelledError extends Error {
  constructor() {
    super("Nie wybrano karty przeglądarki");
    this.name = "AttachCancelledError";
  }
}

export function isOwnSession(session: SessionLike, marker: string): boolean {
  return session.configuration[MARKER_KEY] === marker;
}

/** Sesja potomna (strona) uruchomiona przez naszą sesję główną — nigdy cudzą. */
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
