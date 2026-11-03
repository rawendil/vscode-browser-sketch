import type { CdpClient } from "./cdp";

type Cdp = Pick<CdpClient, "send">;

export class BlankPageError extends Error {
  constructor() {
    super("Brak otwartej strony w przeglądarce");
    this.name = "BlankPageError";
  }
}

export interface PageSession {
  sessionId: string;
  url: string;
}

interface TargetInfo {
  targetId: string;
  type: string;
  url?: string;
}

/**
 * Podpina się pod stronę za pośrednikiem CDP z vscode-js-debug.
 * Od VS Code 1.117 pośrednik wymaga jawnego podpięcia pod cel przeglądarki,
 * a polecenia strony muszą nieść sessionId strony.
 */
export async function attachToPage(cdp: Cdp): Promise<PageSession> {
  const browser = await cdp.send<{ sessionId: string }>("Target.attachToBrowserTarget");
  const { targetInfos } = await cdp.send<{ targetInfos: TargetInfo[] }>(
    "Target.getTargets",
    undefined,
    browser.sessionId,
  );
  // Pośrednik sesji potomnej obejmuje jedną kartę, więc pierwsza strona jest tą właściwą.
  const page = targetInfos.find((t) => t.type === "page");
  const url = page?.url ?? "";
  if (!page || url === "" || url === "about:blank") {
    throw new BlankPageError();
  }
  const { sessionId } = await cdp.send<{ sessionId: string }>(
    "Target.attachToTarget",
    { targetId: page.targetId, flatten: true },
    browser.sessionId,
  );
  return { sessionId, url };
}

/** Zrzut widocznego obszaru w pikselach urządzenia (PNG). */
export async function captureViewport(cdp: Cdp, sessionId: string): Promise<Buffer> {
  const { data } = await cdp.send<{ data: string }>("Page.captureScreenshot", { format: "png" }, sessionId);
  return Buffer.from(data, "base64");
}
