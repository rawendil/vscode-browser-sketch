import * as vscode from "vscode";
import { captureBrowser } from "./capture";
import { openSketch } from "./sketch/panel";
import { cleanCaptures } from "./storage";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const log = vscode.window.createOutputChannel("Browser Sketch");
  const capturesDir = vscode.Uri.joinPath(context.globalStorageUri, "captures");
  context.subscriptions.push(log);

  // Leftovers from previous runs (older than a day).
  await cleanCaptures(capturesDir.fsPath, 24 * 60 * 60 * 1000).catch((err) => log.appendLine(`Cleanup: ${err}`));

  let busy = false;
  context.subscriptions.push(
    vscode.commands.registerCommand("browserSketch.capture", async () => {
      if (busy) return;
      busy = true;
      try {
        const image = await captureBrowser(capturesDir, log);
        if (image) openSketch(context.extensionUri, image, capturesDir);
      } finally {
        busy = false;
      }
    }),
  );

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
  status.text = "$(device-camera)";
  status.tooltip = "Screenshot Browser";
  status.command = "browserSketch.capture";
  status.show();
  context.subscriptions.push(status);
}

export function deactivate(): void {}
