import { describe, expect, test, vi } from "vitest";
import { BlankPageError, captureViewport, inspectPage } from "./page";

function fakeCdp(targetInfo: { type: string; url?: string }) {
  const send = vi.fn(async (method: string): Promise<any> => {
    if (method === "Target.getTargetInfo") return { targetInfo: { targetId: "P1", ...targetInfo } };
    throw new Error(`nieoczekiwane ${method}`);
  });
  return { send: send as any, calls: send.mock.calls };
}

describe("inspectPage", () => {
  test("asks for the proxy target without sessionId and returns the page URL", async () => {
    const cdp = fakeCdp({ type: "page", url: "http://localhost:5173/" });
    expect(await inspectPage(cdp)).toEqual({ url: "http://localhost:5173/" });
    expect(cdp.calls).toEqual([["Target.getTargetInfo"]]);
  });

  test("throws BlankPageError for about:blank", async () => {
    await expect(inspectPage(fakeCdp({ type: "page", url: "about:blank" }))).rejects.toBeInstanceOf(BlankPageError);
  });

  test("throws BlankPageError for an empty url", async () => {
    await expect(inspectPage(fakeCdp({ type: "page", url: "" }))).rejects.toBeInstanceOf(BlankPageError);
  });

  test("throws BlankPageError when the target is not a page", async () => {
    await expect(inspectPage(fakeCdp({ type: "service_worker", url: "http://x/sw.js" }))).rejects.toBeInstanceOf(
      BlankPageError,
    );
  });
});

describe("captureViewport", () => {
  test("sends Page.captureScreenshot {format:'png'} without sessionId and decodes base64", async () => {
    const send = vi.fn(async () => ({ data: Buffer.from("PNG").toString("base64") }));
    const png = await captureViewport({ send: send as any });
    expect(png.toString()).toBe("PNG");
    expect(send).toHaveBeenCalledWith("Page.captureScreenshot", { format: "png" });
  });
});
