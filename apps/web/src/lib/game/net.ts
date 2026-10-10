import type { ClientMsg, ServerMsg } from '@campus/shared';

/** Where is the game server? Works out of the box locally and in GitHub Codespaces. */
export function resolveWsUrl(): string {
  const configured = import.meta.env.VITE_WS_URL as string | undefined;
  if (configured) return configured;
  const { protocol, hostname } = window.location;
  if (hostname.endsWith('.app.github.dev')) {
    // https://<name>-5173.app.github.dev  ->  wss://<name>-8080.app.github.dev
    return 'wss://' + hostname.replace(/-\d+\.app\.github\.dev$/, '-8080.app.github.dev');
  }
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${hostname}:8080`;
}

export interface NetHandlers {
  onOpen(): void;
  onMessage(msg: ServerMsg): void;
  onClose(code: number): void;
}

/** Tiny WebSocket wrapper with automatic reconnect. */
export class Net {
  private ws: WebSocket | null = null;
  private stopped = false;
  private attempt = 0;
  private retry: number | undefined;

  constructor(
    private url: string,
    private handlers: NetHandlers
  ) {}

  connect() {
    if (this.stopped) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0;
      this.handlers.onOpen();
    };
    ws.onmessage = (e) => {
      try {
        this.handlers.onMessage(JSON.parse(e.data as string) as ServerMsg);
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = (e) => {
      if (this.ws === ws) this.ws = null;
      this.handlers.onClose(e.code);
      if (e.code === 4001) this.stopped = true; // signed in elsewhere: don't fight for the slot
      if (this.stopped) return;
      const delay = Math.min(5000, 400 * 2 ** this.attempt++);
      this.retry = window.setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => {
      /* onclose follows */
    };
  }

  send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.stopped = true;
    if (this.retry) window.clearTimeout(this.retry);
    this.ws?.close();
    this.ws = null;
  }
}
