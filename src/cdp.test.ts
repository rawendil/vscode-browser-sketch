import { afterEach, describe, expect, test, vi } from "vitest";
import { CdpClient, CdpError, type SocketLike } from "./cdp";

class FakeSocket implements SocketLike {
  sent: string[] = [];
  private listeners: Record<string, ((e?: any) => void)[]> = {};

  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.emit("close");
  }
  addEventListener(type: string, fn: (e?: any) => void): void {
    (this.listeners[type] ??= []).push(fn);
  }
  emit(type: string, e?: unknown): void {
    for (const fn of this.listeners[type] ?? []) fn(e);
  }
  reply(message: object): void {
    this.emit("message", { data: JSON.stringify(message) });
  }
  frame(i: number): any {
    return JSON.parse(this.sent[i]);
  }
}

describe("CdpClient", () => {
  test("kolejne żądania mają rosnące id i dostają swoje wyniki", async () => {
    const socket = new FakeSocket();
    const cdp = new CdpClient(socket);
    const pA = cdp.send("A");
    const pB = cdp.send("B");
    expect(socket.frame(0)).toMatchObject({ id: 1, method: "A" });
    expect(socket.frame(1)).toMatchObject({ id: 2, method: "B" });
    socket.reply({ id: 2, result: { b: 1 } });
    socket.reply({ id: 1, result: { a: 1 } });
    expect(await pA).toEqual({ a: 1 });
    expect(await pB).toEqual({ b: 1 });
  });

  test("sessionId trafia do ramki, gdy podany", () => {
    const socket = new FakeSocket();
    const cdp = new CdpClient(socket);
    void cdp.send("Page.captureScreenshot", { format: "png" }, "S1");
    void cdp.send("Target.getTargets");
    expect(socket.frame(0)).toEqual({
      id: 1,
      method: "Page.captureScreenshot",
      params: { format: "png" },
      sessionId: "S1",
    });
    expect(socket.frame(1)).not.toHaveProperty("sessionId");
  });

  test("odpowiedź z error odrzuca CdpError z message i code", async () => {
    const socket = new FakeSocket();
    const cdp = new CdpClient(socket);
    const p = cdp.send("A");
    socket.reply({ id: 1, error: { code: -32000, message: "x" } });
    const err = (await p.catch((e) => e)) as CdpError;
    expect(err).toBeInstanceOf(CdpError);
    expect(err.message).toContain("x");
    expect(err.code).toBe(-32000);
  });

  test("zamknięcie gniazda odrzuca wszystkie oczekujące żądania", async () => {
    const socket = new FakeSocket();
    const cdp = new CdpClient(socket);
    const pA = cdp.send("A");
    const pB = cdp.send("B");
    socket.emit("close");
    await expect(pA).rejects.toBeInstanceOf(CdpError);
    await expect(pB).rejects.toBeInstanceOf(CdpError);
  });

  test("żądanie po zamknięciu jest odrzucane od razu", async () => {
    const socket = new FakeSocket();
    const cdp = new CdpClient(socket);
    cdp.close();
    await expect(cdp.send("A")).rejects.toBeInstanceOf(CdpError);
  });

  test("zdarzenia bez id są ignorowane", async () => {
    const socket = new FakeSocket();
    const cdp = new CdpClient(socket);
    const p = cdp.send("A");
    socket.reply({ method: "Page.loadEventFired", params: {} });
    socket.reply({ id: 1, result: {} });
    expect(await p).toEqual({});
  });

  describe("limit czasu", () => {
    afterEach(() => vi.useRealTimers());

    test("żądanie bez odpowiedzi jest odrzucane po limicie czasu", async () => {
      vi.useFakeTimers();
      const cdp = new CdpClient(new FakeSocket(), 1000);
      const p = cdp.send("Page.captureScreenshot");
      vi.advanceTimersByTime(1000);
      await expect(p).rejects.toBeInstanceOf(CdpError);
    });
  });
});
