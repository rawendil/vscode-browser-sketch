import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("browserSketch.capture", () => {
      void vscode.window.showInformationMessage("Browser Sketch działa");
    }),
  );
}

export function deactivate(): void {}
