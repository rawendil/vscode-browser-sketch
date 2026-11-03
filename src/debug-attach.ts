import { randomUUID } from "node:crypto";
import * as vscode from "vscode";
import { attachConfig, AttachCancelledError, isOwnChild, isOwnSession, TimeoutError, waitFor } from "./session-match";

export interface AttachedBrowser {
  child: vscode.DebugSession;
  root: vscode.DebugSession | undefined;
  stop(): Promise<void>;
}

/** How long after the timeout we keep stopping our own session if it starts late. */
const LATE_SESSION_MS = 5 * 60 * 1000;

/**
 * Starts our own `editor-browser` session in attach mode (attaching to an existing tab)
 * and waits for its page child session. Never touches other sessions.
 * VS Code may show the tab picker (even for a single tab), so the timeout covers the picking time.
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
  // If startDebugging fails, nobody is waiting on this promise anymore.
  childPromise.catch(() => {});

  try {
    // Without `noDebug`: with it vscode-js-debug does not start the attach session at all (VS Code 1.144).
    const started = vscode.debug.startDebugging(
      undefined,
      attachConfig(marker),
      {
        suppressDebugToolbar: true,
        suppressDebugView: true,
        suppressDebugStatusbar: true,
      },
    );
    // startDebugging may take long to return even though the sessions are already running — the child session decides.
    // Tab picker closed: startDebugging returns false or our root session ends without a child.
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
      // The tab picker may still be open — if someone picks a tab later, we don't leave the session behind.
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
