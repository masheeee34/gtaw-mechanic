import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRpc } from '../src/rpc.js';

/** Minimal stand-in for FiveM's emitNet/onNet, letting the test play the server. */
function createNetwork() {
  const handlers = new Map();
  const sent = [];
  return {
    sent,
    emitNet: (event, ...args) => sent.push({ event, args }),
    onNet: (event, handler) => handlers.set(event, handler),
    reply: (id, payload) => handlers.get('gtaw-mechanic:response')(id, payload),
  };
}

describe('createRpc', () => {
  let network;
  let rpc;

  beforeEach(() => {
    vi.useFakeTimers();
    network = createNetwork();
    rpc = createRpc({ emitNet: network.emitNet, onNet: network.onNet, prefix: 'gtaw-mechanic', timeoutMs: 5000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prefixes the event and sends a request id before the arguments', () => {
    void rpc.request('repair', 'burton', 42, 'engine');

    expect(network.sent).toEqual([{ event: 'gtaw-mechanic:repair', args: [1, 'burton', 42, 'engine'] }]);
  });

  it('resolves with the parsed server payload', async () => {
    const pending = rpc.request('openSession', 'burton', 42);
    network.reply(1, JSON.stringify({ ok: true, data: { plate: '46EEK572' } }));

    await expect(pending).resolves.toEqual({ ok: true, data: { plate: '46EEK572' } });
    expect(rpc.pendingCount()).toBe(0);
  });

  it('matches concurrent responses to their own request', async () => {
    const first = rpc.request('openSession', 'burton', 1);
    const second = rpc.request('openSession', 'burton', 2);
    network.reply(2, JSON.stringify({ ok: true, data: 'second' }));
    network.reply(1, JSON.stringify({ ok: false, error: 'forbidden' }));

    await expect(first).resolves.toEqual({ ok: false, error: 'forbidden' });
    await expect(second).resolves.toEqual({ ok: true, data: 'second' });
  });

  it('resolves to a timeout error when the server never answers, and ignores a late answer', async () => {
    const pending = rpc.request('repair', 'burton', 42, 'engine');
    vi.advanceTimersByTime(5000);

    await expect(pending).resolves.toEqual({ ok: false, error: 'timeout' });
    expect(() => network.reply(1, JSON.stringify({ ok: true }))).not.toThrow();
    expect(rpc.pendingCount()).toBe(0);
  });

  it('turns an unreadable payload into a bad_response error', async () => {
    const pending = rpc.request('repair', 'burton', 42, 'engine');
    network.reply(1, '<html>');

    await expect(pending).resolves.toEqual({ ok: false, error: 'bad_response' });
  });

  it('ignores responses to unknown request ids', () => {
    void rpc.request('repair', 'burton', 42, 'engine');
    network.reply(99, JSON.stringify({ ok: true }));

    expect(rpc.pendingCount()).toBe(1);
  });
});
