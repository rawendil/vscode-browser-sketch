import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { isOwnChild, isOwnSession, MARKER_KEY, waitFor } from "./session-match";

export interface AttachedBrowser {
  child: vscode.DebugSession;
  root: vscode.DebugSession | undefined;
  stop(): Promise<void>;
}

/**
 * Uruchamia własną sesję `editor-browser` w trybie attach (podpięcie pod istniejącą kartę)
 * i czeka na jej sesję potomną strony. Cudzych sesji nie dotyka.
 */
export async function attachToBrowser(timeoutMs = 15000): Promise<AttachedBrowser> {
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
    const started = await vscode.debug.startDebugging(
      undefined,
      {
        type: "editor-browser",
        request: "attach",
        name: "Browser Sketch",
        internalConsoleOptions: "neverOpen",
        [MARKER_KEY]: marker,
      },
      {
        noDebug: true,
        suppressDebugToolbar: true,
        suppressDebugView: true,
        suppressDebugStatusbar: true,
      },
    );
    if (!started) throw new Error("Nie udało się podpiąć do przeglądarki");

    const child = await childPromise;
    root ??= child.parentSession;
    return {
      child,
      root,
      stop: async () => {
        await vscode.debug.stopDebugging(root ?? child);
      },
    };
  } catch (err) {
    await stopRoot();
    throw err;
  } finally {
    rootListener.dispose();
  }
}
