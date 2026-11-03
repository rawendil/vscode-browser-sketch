export interface SocketLike {
  send(data: string): void;
  close(): void;
  addEventListener(type: "message", fn: (e: { data: unknown }) => void): void;
  addEventListener(type: "close" | "error", fn: () => void): void;
}

export class CdpError extends Error {
  constructor(
    message: string,
    public code?: number,
  ) {
    super(message);
    this.name = "CdpError";
  }
}

interface Pending {
  method: string;
  resolve(value: unknown): void;
  reject(err: Error): void;
}

/** Minimalny klient Chrome DevTools Protocol na jednym WebSockecie (tryb flatten). */
export class CdpClient {
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private closed = false;

  constructor(private socket: SocketLike) {
    socket.addEventListener("message", (e) => this.onMessage(e.data));
    socket.addEventListener("close", () => this.onClose());
  }

  static connect(url: string, timeoutMs = 5000): Promise<CdpClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      const timer = setTimeout(() => {
        ws.close();
        reject(new CdpError(`Brak połączenia z ${url} po ${timeoutMs} ms`));
      }, timeoutMs);
      ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve(new CdpClient(ws));
      });
      ws.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new CdpError(`Nie udało się połączyć z ${url}`));
      });
    });
  }

  send<T = unknown>(method: string, params?: object, sessionId?: string): Promise<T> {
    if (this.closed) {
      return Promise.reject(new CdpError(`${method}: połączenie CDP zamknięte`));
    }
    const id = this.nextId++;
    const frame: Record<string, unknown> = { id, method };
    if (params) frame.params = params;
    if (sessionId) frame.sessionId = sessionId;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { method, resolve: resolve as (v: unknown) => void, reject });
      this.socket.send(JSON.stringify(frame));
    });
  }

  close(): void {
    if (this.closed) return;
    this.socket.close();
    this.onClose();
  }

  private onMessage(data: unknown): void {
    const message = JSON.parse(String(data));
    if (typeof message.id !== "number") return;
    const entry = this.pending.get(message.id);
    if (!entry) return;
    this.pending.delete(message.id);
    if (message.error) {
      entry.reject(new CdpError(`${entry.method}: ${message.error.message}`, message.error.code));
    } else {
      entry.resolve(message.result);
    }
  }

  private onClose(): void {
    this.closed = true;
    for (const entry of this.pending.values()) {
      entry.reject(new CdpError(`${entry.method}: połączenie CDP zamknięte`));
    }
    this.pending.clear();
  }
}
