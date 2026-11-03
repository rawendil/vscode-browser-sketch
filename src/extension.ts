import { posix } from "node:path";
import * as vscode from "vscode";
import { captureBrowser } from "./capture";
import { openSketch } from "./sketch/panel";
import { cleanCaptures, importFileName } from "./storage";
import { svgRasterSize } from "./svg-size";
import { firstVisibleImage, imageNameFromLabel, pickVisibleImage, type VisibleTab } from "./visible-image";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const log = vscode.window.createOutputChannel("Browser Sketch");
  const capturesDir = vscode.Uri.joinPath(context.globalStorageUri, "captures");
  context.subscriptions.push(log);

  // Leftovers from previous runs (older than a day).
  await cleanCaptures(capturesDir.fsPath, 24 * 60 * 60 * 1000).catch((err) => log.appendLine(`Cleanup: ${err}`));

  async function openImage(source: vscode.Uri): Promise<void> {
    // The sketch tab deletes its file on close, so it gets a copy, never the original.
    // Written anew rather than copied, so it has a fresh mtime and cleanup leaves it alone.
    const copy = vscode.Uri.joinPath(capturesDir, importFileName(new Date(), source.path));
    let bytes: Uint8Array;
    try {
      bytes = await vscode.workspace.fs.readFile(source);
      await vscode.workspace.fs.writeFile(copy, bytes);
    } catch (err) {
      void vscode.window.showErrorMessage(`Could not open the image: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    // A vector image has no pixel size of its own; the sketch tab renders it to a bitmap of this size.
    const raster = copy.path.endsWith(".svg") ? svgRasterSize(new TextDecoder().decode(bytes)) : undefined;
    openSketch(context.extensionUri, copy, capturesDir, `Sketch: ${posix.basename(source.path)}`, raster);
  }

  let busy = false;
  context.subscriptions.push(
    vscode.commands.registerCommand("browserSketch.capture", async () => {
      if (busy) return;
      busy = true;
      try {
        // An image preview on screen (and no browser) means the user wants to draw on that image.
        const visibleImage = pickVisibleImage(...visibleTabs());
        if (visibleImage) {
          const source = await resolveImage(visibleImage);
          if (source) await openImage(source);
          return;
        }
        const image = await captureBrowser(capturesDir, log);
        if (image) openSketch(context.extensionUri, image, capturesDir);
      } finally {
        busy = false;
      }
    }),
    // From the Explorer or the image preview title bar `source` is the file; from the Command Palette
    // we take the image preview on screen, or ask for a file when there is none.
    vscode.commands.registerCommand("browserSketch.openImage", async (source?: vscode.Uri) => {
      const visible = source ? undefined : firstVisibleImage(...visibleTabs());
      // An image is on screen but the user cancelled picking which file it is — stop there.
      if (visible !== undefined) source = await resolveImage(visible);
      else source ??= (
        await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { Images: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"] },
          title: "Open Image in Sketch",
        })
      )?.[0];
      if (source) await openImage(source);
    }),
  );

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
  status.text = "$(device-camera)";
  status.tooltip = "Screenshot Browser";
  status.command = "browserSketch.capture";
  status.show();
  context.subscriptions.push(status);
}

/** An image on screen: its URI, or only its file name for VS Code's native image preview (1.144+). */
type ImageRef = vscode.Uri | string;

/** The focused tab and the active tabs of the other editor groups — what is on screen. */
function visibleTabs(): [VisibleTab<ImageRef> | undefined, VisibleTab<ImageRef>[]] {
  const { activeTabGroup, all } = vscode.window.tabGroups;
  return [
    activeTabGroup.activeTab && describeTab(activeTabGroup.activeTab),
    all.filter((g) => g !== activeTabGroup && g.activeTab).map((g) => describeTab(g.activeTab!)),
  ];
}

function describeTab(tab: vscode.Tab): VisibleTab<ImageRef> {
  const input = tab.input;
  // Before VS Code 1.144 the image preview was the media-preview extension's custom editor.
  if (input instanceof vscode.TabInputCustom && input.viewType === "imagePreview.previewEditor") {
    return { kind: "image", uri: input.uri };
  }
  if (input !== undefined) return { kind: "other" };
  const name = imageNameFromLabel(tab.label);
  return name ? { kind: "image", uri: name } : { kind: "unknown" };
}

/**
 * The native image preview tells us only the file name, so we look it up in the workspace:
 * one match is the file, several give a choice, none (e.g. a file outside the workspace) asks for the file.
 */
async function resolveImage(ref: ImageRef): Promise<vscode.Uri | undefined> {
  if (typeof ref !== "string") return ref;
  const glob = `**/${ref.replace(/[[\]{}*?]/g, "[$&]")}`;
  const matches = await vscode.workspace.findFiles(glob, "**/node_modules/**", 50);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const picked = await vscode.window.showQuickPick(
      matches.map((uri) => ({ label: vscode.workspace.asRelativePath(uri), uri })),
      { title: `Open Image in Sketch: which ${ref}?` },
    );
    return picked?.uri;
  }
  return (
    await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { Images: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg"] },
      title: `Open Image in Sketch: ${ref} is not in the workspace — pick it`,
    })
  )?.[0];
}

export function deactivate(): void {}
