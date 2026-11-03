import * as vscode from "vscode";
import { CdpClient } from "./cdp";
import { attachToBrowser, type AttachedBrowser } from "./debug-attach";
import { BlankPageError, captureViewport, inspectPage } from "./page";
import { AttachCancelledError, withTimeout } from "./session-match";
import { captureFileName } from "./storage";

interface CdpProxy {
  host: string;
  port: number;
  path?: string;
}

/**
 * Zrzut widocznej części otwartej karty wbudowanej przeglądarki do `storageDir`.
 * Zwraca plik albo `undefined`, gdy zrzutu nie ma.
 */
export async function captureBrowser(
  storageDir: vscode.Uri,
  log: vscode.OutputChannel,
): Promise<vscode.Uri | undefined> {
  const started = Date.now();
  const step = (name: string, since: number) => log.appendLine(`  ${name}: ${Date.now() - since} ms`);
  let browser: AttachedBrowser | undefined;
  let cdp: CdpClient | undefined;

  log.appendLine(`[${new Date().toISOString()}] Screenshot`);
  try {
    let t = Date.now();
    const waiting = vscode.window.setStatusBarMessage("$(loading~spin) Browser Sketch: attaching to the browser tab…");
    try {
      browser = await attachToBrowser();
    } finally {
      waiting.dispose();
    }
    step("attach", t);

    t = Date.now();
    const proxy = (await withTimeout(browser.child.customRequest("requestCDPProxy"), 10000)) as CdpProxy;
    cdp = await CdpClient.connect(`ws://${proxy.host}:${proxy.port}${proxy.path ?? ""}`);
    step("CDP proxy", t);

    t = Date.now();
    const page = await inspectPage(cdp);
    const png = await captureViewport(cdp);
    step("capture", t);
    log.appendLine(`  page: ${page.url}, ${png.length} B`);

    const uri = vscode.Uri.joinPath(storageDir, captureFileName(new Date()));
    await vscode.workspace.fs.writeFile(uri, png);
    return uri;
  } catch (err) {
    log.appendLine(`  error: ${err instanceof Error ? err.stack : String(err)}`);
    if (err instanceof BlankPageError) {
      void vscode.window.showWarningMessage(
        "No browser tab is open. Open a page in the Integrated Browser and try again.",
      );
    } else if (err instanceof AttachCancelledError) {
      // Zamknięty wybór karty — bez okna z błędem.
      vscode.window.setStatusBarMessage("Browser Sketch: no browser tab selected", 5000);
    } else {
      void vscode.window.showErrorMessage(`Screenshot failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return undefined;
  } finally {
    cdp?.close();
    await browser?.stop().catch((err) => log.appendLine(`  stop: ${err}`));
    step("total", started);
  }
}
