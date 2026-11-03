import * as vscode from "vscode";
import { captureBrowser } from "./capture";
import { cleanCaptures } from "./storage";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const log = vscode.window.createOutputChannel("Browser Sketch");
  const capturesDir = vscode.Uri.joinPath(context.globalStorageUri, "captures");
  context.subscriptions.push(log);

  // Resztki z poprzednich uruchomień (starsze niż doba).
  await cleanCaptures(capturesDir.fsPath, 24 * 60 * 60 * 1000).catch((err) => log.appendLine(`Sprzątanie: ${err}`));

  let busy = false;
  context.subscriptions.push(
    vscode.commands.registerCommand("browserSketch.capture", async () => {
      if (busy) return;
      busy = true;
      try {
        await captureBrowser(capturesDir, log);
      } finally {
        busy = false;
      }
    }),
  );

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
  status.text = "$(device-camera)";
  status.tooltip = "Zrzut przeglądarki";
  status.command = "browserSketch.capture";
  status.show();
  context.subscriptions.push(status);
}

export function deactivate(): void {}
