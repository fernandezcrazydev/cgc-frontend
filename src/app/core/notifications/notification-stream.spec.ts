import { openNotificationStream } from './notification-stream';

/** Un `Response` cuyo cuerpo emite `chunks` como un stream `text/event-stream`. */
function streamedResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

const NOTIF = '{"id":"n1","type":"INVITED_TO_GROUP","data":{"groupName":"X"},"read":false,"createdAt":"2026-07-18T12:00:00Z"}';

describe('openNotificationStream', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('un 401 se cierra reportando el status, para que el llamante renueve el token', async () => {
    globalThis.fetch = (() => Promise.resolve(new Response(null, { status: 401 }))) as typeof fetch;

    const reason = await new Promise<{ aborted: boolean; status: number | null }>((resolve) => {
      openNotificationStream('http://x/stream', 'caducado', {
        onNotification: () => {},
        onClose: resolve,
      });
    });

    expect(reason).toEqual({ aborted: false, status: 401 });
  });

  it('emite el JSON de cada frame `event: notification`', async () => {
    const frame = `event: notification\ndata: ${NOTIF}\n\n`;
    globalThis.fetch = (() => Promise.resolve(streamedResponse([frame]))) as typeof fetch;

    const received: unknown[] = [];
    await new Promise<void>((resolve) => {
      openNotificationStream('http://x/stream', 'tok', {
        onNotification: (n) => received.push(n),
        onClose: () => resolve(),
      });
    });

    expect(received).toHaveLength(1);
    expect((received[0] as { id: string }).id).toBe('n1');
  });

  it('junta frames partidos entre varios chunks e ignora los heartbeat', async () => {
    const chunks = [': keep-alive\n\n', 'event: notification\nda', `ta: ${NOTIF}\n\n`];
    globalThis.fetch = (() => Promise.resolve(streamedResponse(chunks))) as typeof fetch;

    const received: unknown[] = [];
    await new Promise<void>((resolve) => {
      openNotificationStream('http://x/stream', 'tok', {
        onNotification: (n) => received.push(n),
        onClose: () => resolve(),
      });
    });

    expect(received).toHaveLength(1);
  });

  it('manda el Bearer y acepta text/event-stream', async () => {
    let init: RequestInit | undefined;
    globalThis.fetch = ((_url: string, options: RequestInit) => {
      init = options;
      return Promise.resolve(streamedResponse([]));
    }) as typeof fetch;

    await new Promise<void>((resolve) => {
      openNotificationStream('http://x/stream', 'tok', {
        onNotification: () => {},
        onClose: () => resolve(),
      });
    });

    const headers = init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer tok');
    expect(headers['Accept']).toBe('text/event-stream');
  });
});
