import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { AttachCancelledError, isOwnChild, isOwnSession, MARKER_KEY, TimeoutError, waitFor } from "./session-match";

export interface AttachedBrowser {
  child: vscode.DebugSession;
  root: vscode.DebugSession | undefined;
  stop(): Promise<void>;
}

/** Jak długo po przekroczeniu limitu zatrzymujemy własną sesję, która wystartuje spóźniona. */
const LATE_SESSION_MS = 5 * 60 * 1000;

/**
 * Uruchamia własną sesję `editor-browser` w trybie attach (podpięcie pod istniejącą kartę)
 * i czeka na jej sesję potomną strony. Cudzych sesji nie dotyka.
 * VS Code może pokazać wybór karty (także przy jednej), więc limit obejmuje czas wyboru.
 */
export async function attachToBrowser(timeoutMs = 60000): Promise<AttachedBrowser> {
  const marker = randomUUID();
  let root: vscode.DebugSession | undefined;
  const rootListener = vscode.debug.onDidStartDebugSession((s) => {
    if (!s.parentSession && isOwnSession(s, marker)) root = s;
  });
  const stopRoot = async () => {
    if (root) await vscode.debug.stopDebugging(root);
  };

  const childPromise = waitFor<vscode.DebugSession>(
    (cb) => vscode.debug.onDidStartDebugSession(cb),
    (s) => isOwnChild(s, marker),
    timeoutMs,
  );
  // Gdy startDebugging zawiedzie, nikt już nie czeka na tę obietnicę.
  childPromise.catch(() => {});

  try {
    // Bez `noDebug`: z nim vscode-js-debug nie uruchamia sesji attach wcale (VS Code 1.144).
    const started = vscode.debug.startDebugging(
      undefined,
      {
        type: "editor-browser",
        request: "attach",
        name: "Browser Sketch",
        internalConsoleOptions: "neverOpen",
        [MARKER_KEY]: marker,
      },
      {
        suppressDebugToolbar: true,
        suppressDebugView: true,
        suppressDebugStatusbar: true,
      },
    );
    // startDebugging potrafi długo nie wracać, choć sesje już działają — rozstrzyga sesja potomna.
    // Zamknięty wybór karty: startDebugging zwraca false albo nasza sesja główna kończy się bez potomnej.
    const rootEnded = waitFor<vscode.DebugSession>(
      (cb) => vscode.debug.onDidTerminateDebugSession(cb),
      (s) => !s.parentSession && isOwnSession(s, marker),
      timeoutMs,
    ).then(() => {
      throw new AttachCancelledError();
    });
    rootEnded.catch(() => {});
    const child = await Promise.race([
      childPromise,
      rootEnded,
      Promise.resolve(started).then((ok) => {
        if (!ok) throw new AttachCancelledError();
        return childPromise;
      }),
    ]).catch((err) => {
      throw err instanceof TimeoutError ? new AttachCancelledError() : err;
    });
    root ??= child.parentSession;
    return {
      child,
      root,
      stop: async () => {
        await vscode.debug.stopDebugging(root ?? child);
      },
    };
  } catch (err) {
    if (root) {
      await stopRoot().catch(() => {});
    } else {
      // Wybór karty mógł zostać otwarty — jeśli ktoś wybierze kartę później, nie zostawiamy sesji.
      waitFor<vscode.DebugSession>(
        (cb) => vscode.debug.onDidStartDebugSession(cb),
        (s) => !s.parentSession && isOwnSession(s, marker),
        LATE_SESSION_MS,
      ).then((late) => vscode.debug.stopDebugging(late), () => {});
    }
    throw err;
  } finally {
    rootListener.dispose();
  }
}
