import { describe, expect, test, vi } from "vitest";
import { attachToPage, BlankPageError, captureViewport } from "./page";

type Targets = { targetId: string; type: string; url?: string }[];

function fakeCdp(targets: Targets) {
  const send = vi.fn(async (method: string, _params?: object, _sessionId?: string): Promise<any> => {
    switch (method) {
      case "Target.attachToBrowserTarget":
        return { sessionId: "B1" };
      case "Target.getTargets":
        return { targetInfos: targets };
      case "Target.attachToTarget":
        return { sessionId: "S1" };
    }
    throw new Error(`nieoczekiwane ${method}`);
  });
  return { send: send as any, calls: send.mock.calls };
}

describe("attachToPage", () => {
  test("wywołuje attachToBrowserTarget, getTargets, attachToTarget(flatten) w tej kolejności", async () => {
    const cdp = fakeCdp([{ targetId: "P1", type: "page", url: "http://localhost:5173/" }]);
    const page = await attachToPage(cdp);
    expect(cdp.calls.map((c) => c[0])).toEqual([
      "Target.attachToBrowserTarget",
      "Target.getTargets",
      "Target.attachToTarget",
    ]);
    expect(cdp.calls[2][1]).toEqual({ targetId: "P1", flatten: true });
    expect(page).toEqual({ sessionId: "S1", url: "http://localhost:5173/" });
  });

  test("getTargets i attachToTarget idą przez sesję przeglądarki", async () => {
    const cdp = fakeCdp([{ targetId: "P1", type: "page", url: "http://x/" }]);
    await attachToPage(cdp);
    expect(cdp.calls[0][2]).toBeUndefined();
    expect(cdp.calls[1][2]).toBe("B1");
    expect(cdp.calls[2][2]).toBe("B1");
  });

  test("pomija cele, które nie są stroną", async () => {
    const cdp = fakeCdp([
      { targetId: "W1", type: "service_worker", url: "http://x/sw.js" },
      { targetId: "P1", type: "page", url: "http://x/" },
    ]);
    await attachToPage(cdp);
    expect(cdp.calls[2][1]).toEqual({ targetId: "P1", flatten: true });
  });

  test("rzuca BlankPageError dla about:blank", async () => {
    const cdp = fakeCdp([{ targetId: "P1", type: "page", url: "about:blank" }]);
    await expect(attachToPage(cdp)).rejects.toBeInstanceOf(BlankPageError);
  });

  test("rzuca BlankPageError dla pustego url", async () => {
    const cdp = fakeCdp([{ targetId: "P1", type: "page", url: "" }]);
    await expect(attachToPage(cdp)).rejects.toBeInstanceOf(BlankPageError);
  });

  test("rzuca BlankPageError, gdy nie ma żadnej strony", async () => {
    const cdp = fakeCdp([{ targetId: "W1", type: "service_worker" }]);
    await expect(attachToPage(cdp)).rejects.toBeInstanceOf(BlankPageError);
  });
});

describe("captureViewport", () => {
  test("wysyła Page.captureScreenshot {format:'png'} z sessionId i dekoduje base64", async () => {
    const send = vi.fn(async () => ({ data: Buffer.from("PNG").toString("base64") }));
    const png = await captureViewport({ send: send as any }, "S1");
    expect(png.toString()).toBe("PNG");
    expect(send).toHaveBeenCalledWith("Page.captureScreenshot", { format: "png" }, "S1");
  });
});
