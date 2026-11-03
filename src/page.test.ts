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
  test("pyta o cel pośrednika bez sessionId i zwraca adres strony", async () => {
    const cdp = fakeCdp({ type: "page", url: "http://localhost:5173/" });
    expect(await inspectPage(cdp)).toEqual({ url: "http://localhost:5173/" });
    expect(cdp.calls).toEqual([["Target.getTargetInfo"]]);
  });

  test("rzuca BlankPageError dla about:blank", async () => {
    await expect(inspectPage(fakeCdp({ type: "page", url: "about:blank" }))).rejects.toBeInstanceOf(BlankPageError);
  });

  test("rzuca BlankPageError dla pustego url", async () => {
    await expect(inspectPage(fakeCdp({ type: "page", url: "" }))).rejects.toBeInstanceOf(BlankPageError);
  });

  test("rzuca BlankPageError, gdy cel nie jest stroną", async () => {
    await expect(inspectPage(fakeCdp({ type: "service_worker", url: "http://x/sw.js" }))).rejects.toBeInstanceOf(
      BlankPageError,
    );
  });
});

describe("captureViewport", () => {
  test("wysyła Page.captureScreenshot {format:'png'} bez sessionId i dekoduje base64", async () => {
    const send = vi.fn(async () => ({ data: Buffer.from("PNG").toString("base64") }));
    const png = await captureViewport({ send: send as any });
    expect(png.toString()).toBe("PNG");
    expect(send).toHaveBeenCalledWith("Page.captureScreenshot", { format: "png" });
  });
});
