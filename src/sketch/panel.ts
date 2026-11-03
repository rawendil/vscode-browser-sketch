import { randomBytes } from "node:crypto";
import * as vscode from "vscode";

/**
 * Otwiera zrzut w nowej karcie edytora rysunku. Plik zrzutu jest tymczasowy —
 * znika razem z kartą, a zamknięcie nie pyta o zapis.
 */
export function openSketch(extensionUri: vscode.Uri, image: vscode.Uri, capturesDir: vscode.Uri): vscode.WebviewPanel {
  const dist = vscode.Uri.joinPath(extensionUri, "dist");
  const panel = vscode.window.createWebviewPanel(
    "browserSketch.sketch",
    `Sketch ${new Date().toLocaleTimeString()}`,
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [capturesDir, dist] },
  );
  const webview = panel.webview;
  const nonce = randomBytes(16).toString("base64");
  const asset = (name: string) => webview.asWebviewUri(vscode.Uri.joinPath(dist, name));

  webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${asset("webview.css")}">
</head>
<body data-image="${webview.asWebviewUri(image)}">
<script nonce="${nonce}" src="${asset("webview.js")}"></script>
</body>
</html>`;

  panel.onDidDispose(() => {
    void vscode.workspace.fs.delete(image).then(undefined, () => {});
  });
  return panel;
}
