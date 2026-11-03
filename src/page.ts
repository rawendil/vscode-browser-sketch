import type { CdpClient } from "./cdp";

type Cdp = Pick<CdpClient, "send">;

export class BlankPageError extends Error {
  constructor() {
    super("No page open in the browser");
    this.name = "BlankPageError";
  }
}

export interface PageInfo {
  url: string;
}

/**
 * The child session's CDP proxy covers a single tab and routes commands to it
 * without `sessionId` (it rejects an explicit `Target.attachToBrowserTarget` — VS Code 1.144).
 */
export async function inspectPage(cdp: Cdp): Promise<PageInfo> {
  const { targetInfo } = await cdp.send<{ targetInfo: { type: string; url?: string } }>("Target.getTargetInfo");
  const url = targetInfo.url ?? "";
  if (targetInfo.type !== "page" || url === "" || url === "about:blank") {
    throw new BlankPageError();
  }
  return { url };
}

/** Screenshot of the visible area in device pixels (PNG). */
export async function captureViewport(cdp: Cdp): Promise<Buffer> {
  const { data } = await cdp.send<{ data: string }>("Page.captureScreenshot", { format: "png" });
  return Buffer.from(data, "base64");
}
