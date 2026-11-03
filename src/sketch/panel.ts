import { randomBytes } from "node:crypto";
import * as vscode from "vscode";

/**
 * Opens an image from `capturesDir` in a new sketch editor tab. The file is temporary —
 * it goes away with the tab, and closing does not prompt to save.
 */
export function openSketch(
  extensionUri: vscode.Uri,
  image: vscode.Uri,
  capturesDir: vscode.Uri,
  title = `Sketch ${new Date().toLocaleTimeString()}`,
  raster?: { w: number; h: number },
): vscode.WebviewPanel {
  const dist = vscode.Uri.joinPath(extensionUri, "dist");
  const panel = vscode.window.createWebviewPanel(
    "browserSketch.sketch",
    title,
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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${asset("webview.css")}">
</head>
<body data-image="${webview.asWebviewUri(image)}"${raster ? ` data-raster="${raster.w}x${raster.h}"` : ""}>
<script nonce="${nonce}" src="${asset("webview.js")}"></script>
</body>
</html>`;

  panel.onDidDispose(() => {
    void vscode.workspace.fs.delete(image).then(undefined, () => {});
  });
  return panel;
}
