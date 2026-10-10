// The default `keyOf` buckets callers by `ctx.ip`, so it is only as good as the address the serving
// path hands it. Node's `listen()` has always filled `ctx.ip` from the socket. `serveDeno` and
// `serveBun` left it as `''` until core #116 (merged in core #117), which put every caller in the
// one `'unknown'` bucket: the first client to reach `max` locked out everybody else.
//
// So this runs over a real socket on each runtime, with the plugin's default `keyOf`, rather than
// through `app.fetch` with a hand-written one — `app.fetch` has no peer, and a custom `keyOf` would
// test the test. Two clients reach one dual-stack listener, one over IPv4 and one over IPv6, which is
// the cheapest way to get two distinct peer addresses on one host.
//
// Against a core without #116 the Deno and Bun runs fail here, on purpose. Node is the control: its
// path never had the bug and must stay green.
import { strict as assert } from 'node:assert';
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';

import { createApp, ctx, Get, Module, needs, Route } from '@green-tea/core';
import type { App } from '@green-tea/core';

import { rateLimit } from '../src/index.ts';
import type { RateLimiter } from '../src/index.ts';

@Route('/')
class Probe {
  @Get('/probe')
  async probe(@needs('rateLimit') limit: RateLimiter, @ctx() context: { ip?: string }) {
    await limit('signin');

    return { ip: context.ip };
  }
}

@Module({ mountpoint: '/', controllers: [Probe] })
class ProbeModule {}

/** A running server, whichever helper started it. */
interface Served {
  port: number;
  close(): Promise<void>;
}

interface RuntimeGlobals {
  Deno?: unknown;
  Bun?: unknown;
}

/**
 * Serves `app` on `hostname` through the helper this runtime actually uses in production.
 *
 * The adapters are imported lazily because each one only works on its own runtime. Node takes no
 * hostname: `listen(port)` binds the unspecified address, which is dual-stack wherever IPv6 exists.
 */
async function serve(app: App, hostname: string): Promise<Served> {
  const globals = globalThis as RuntimeGlobals;

  if (globals.Deno) {
    const { serveDeno } = await import('@green-tea/core/deno');
    const server = await serveDeno(app, { hostname, port: 0, onListen: () => {} });
    const { port } = (server as unknown as { addr: { port: number } }).addr;

    return { port, close: () => server.close({ timeoutMs: 1_000 }) };
  }

  if (globals.Bun) {
    const { serveBun } = await import('@green-tea/core/bun');
    const server = await serveBun(app, { hostname, port: 0 });

    return { port: server.port, close: () => server.close({ timeoutMs: 1_000 }) };
  }

  const server = await app.listen(0);

  return { port: (server.address() as AddressInfo).port, close: () => app.close({ timeoutMs: 1_000 }) };
}

/** Whether this host can bind the IPv6 loopback at all; some CI containers cannot. */
function ipv6Available(): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();

    probe.once('error', () => resolve(false));
    probe.listen(0, '::1', () => probe.close(() => resolve(true)));
  });
}

test('two peers on different addresses get separate budgets on the real serving path', async (t) => {
  // Without IPv6, the fallback is two IPv4 loopback addresses. Every 127/8 address answers on Linux,
  // which is what CI runs; macOS configures only 127.0.0.1, so there the fallback cannot connect.
  const ipv6 = await ipv6Available();
  const [hostname, a, b] = ipv6 ? ['::', '127.0.0.1', '[::1]'] : ['0.0.0.0', '127.0.0.1', '127.0.0.2'];

  if (!ipv6) t.diagnostic('no IPv6 loopback: falling back to 127.0.0.1 and 127.0.0.2 (Linux only)');

  const app = createApp({
    modules: [ProbeModule],
    plugins: [rateLimit({ rules: { signin: { windowMs: 60_000, max: 1, message: 'too many' } } })],
  });
  const server = await serve(app, hostname);
  const hit = (host: string) => fetch(`http://${host}:${server.port}/probe`);

  try {
    const first = await hit(a);
    assert.equal(first.status, 200);
    const { ip: ipA } = (await first.json()) as { ip?: string };

    assert.equal((await hit(a)).status, 429, 'client A was not limited at max: 1');

    const other = await hit(b);
    const body = (await other.text()) || '(empty body)';

    // Checked before B's status so a regression names its cause: an empty `ctx.ip` is what folds both
    // clients into one bucket, and the 429 that follows is only its symptom.
    assert.ok(ipA, `ctx.ip was empty for client A on this serving path: ${JSON.stringify(ipA)}`);
    assert.equal(other.status, 200, `client B shared client A's bucket (ctx.ip ${JSON.stringify(ipA)}): ${body}`);

    const { ip: ipB } = JSON.parse(body) as { ip?: string };
    assert.ok(ipB, 'ctx.ip was empty for client B');
    assert.notEqual(ipA, ipB, 'both clients reported the same ctx.ip');
  } finally {
    await server.close();
  }
});
