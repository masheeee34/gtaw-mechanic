/**
 * Request/response over net events. The server answers every `<prefix>:<name>` event with
 * `<prefix>:response`, carrying the request id and a JSON payload `{ ok, data }` or `{ ok, error }`.
 * The FiveM functions are injected so the module can be tested outside the game.
 *
 * @param {{ emitNet: Function, onNet: Function, prefix: string, timeoutMs?: number }} options
 */
export function createRpc({ emitNet, onNet, prefix, timeoutMs = 10000 }) {
  let nextId = 0;
  const pending = new Map();

  onNet(`${prefix}:response`, (id, payload) => {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    clearTimeout(request.timer);

    try {
      request.resolve(JSON.parse(payload));
    } catch {
      request.resolve({ ok: false, error: 'bad_response' });
    }
  });

  /**
   * Never rejects: timeouts resolve to `{ ok: false, error: 'timeout' }` like any other failure.
   * @returns {Promise<{ ok: boolean, data?: any, error?: string }>}
   */
  function request(name, ...args) {
    const id = ++nextId;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({ ok: false, error: 'timeout' });
      }, timeoutMs);
      pending.set(id, { resolve, timer });
      emitNet(`${prefix}:${name}`, id, ...args);
    });
  }

  return { request, pendingCount: () => pending.size };
}
