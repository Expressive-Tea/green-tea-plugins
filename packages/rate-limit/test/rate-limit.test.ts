import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { createApp } from '@green-tea/core';
import type { App } from '@green-tea/core';

import { probeModule } from '../../../test/helpers.ts';
import { TooManyRequests } from '../src/errors.ts';
import { rateLimit } from '../src/index.ts';
import type { RateLimiter } from '../src/index.ts';
import { MemoryStore } from '../src/memory-store.ts';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

test('counts hits inside a window and starts a new one after it expires', async () => {
  const store = new MemoryStore();

  try {
    assert.equal(store.hit('a', 40).count, 1);
    assert.equal(store.hit('a', 40).count, 2);
    await sleep(60);
    assert.equal(store.hit('a', 40).count, 1);
  } finally {
    store.close();
  }
});

test('keeps separate counters per key', () => {
  const store = new MemoryStore();

  try {
    store.hit('a', 1000);
    assert.equal(store.hit('b', 1000).count, 1);
    assert.equal(store.hit('a', 1000).count, 2);
  } finally {
    store.close();
  }
});

// The defect this store replaces: `hit()` walked the whole map whenever a key was new or expired,
// so N distinct callers cost N², and a client rotating addresses triggered it on purpose. The sweep
// is what keeps the map bounded now, so it has to actually drop things.
test('sweeps expired windows without being asked on the hot path', async () => {
  const store = new MemoryStore({ sweepMs: 20 });

  try {
    for (let i = 0; i < 50; i++) store.hit(`caller-${i}`, 10);
    assert.equal(store.size, 50);
    await sleep(80);
    assert.equal(store.size, 0, 'expired windows were never swept');
  } finally {
    store.close();
  }
});

test('reset drops every counter', () => {
  const store = new MemoryStore();

  try {
    store.hit('a', 1000);
    store.reset();
    assert.equal(store.size, 0);
  } finally {
    store.close();
  }
});

test('close is idempotent, because close() is called more than once in real apps', () => {
  const store = new MemoryStore();
  store.hit('a', 1000);

  store.close();

  assert.doesNotThrow(() => store.close());
});

// Convention rule 8, checked where it bites. The class never extends core's HttpError — it carries a
// registry-wide symbol, which is what lets a plugin throw a 429 that core renders without importing
// core, and what keeps working when two copies of core are in one tree (`instanceof` does not).
test('carries the brand core recognises, and the fields core reads off it', () => {
  const error = new TooManyRequests('slow down', 30);

  assert.equal((error as unknown as Record<symbol, unknown>)[Symbol.for('green-tea.http-error')], true);
  assert.equal(error.status, 429);
  assert.equal(error.message, 'slow down');
  assert.equal(error.headers['retry-after'], '30');
  assert.deepEqual(error.body, { message: 'slow down', status: 429 });
  // Still an Error: a throw that is not one loses the stack, and core rethrows before rendering.
  assert.ok(error instanceof Error);
});

const RULES = { signin: { windowMs: 60_000, max: 2, message: 'too many' } };

/**
 * Runs `body` against `app` and always closes it.
 *
 * Closing is not housekeeping here. The default store's sweep timer is deliberately not `unref`ed —
 * that is what makes the exit test in this file mean something — so an app left open keeps the test
 * runner alive long after its assertions passed. `close()` runs the plugin's `onShutdown`, which is
 * the same path the exit test measures, so every test here exercises it in passing.
 */
async function withApp(app: App, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } finally {
    await app.close();
  }
}

test('allows up to the limit and then answers 429 with retry-after', async () => {
  const app = createApp({
    modules: [
      probeModule('rateLimit', async (limit: RateLimiter) => {
        await limit('signin');
        return 'ok';
      }),
    ],
    plugins: [rateLimit({ rules: RULES, keyOf: () => 'one-caller' })],
  });

  await withApp(app, async () => {
    const hit = () => app.fetch(new Request('http://plugin.test/rateLimit/probe'));

    assert.equal((await hit()).status, 200);
    assert.equal((await hit()).status, 200);

    const refused = await hit();

    assert.equal(refused.status, 429);
    assert.ok(Number(refused.headers.get('retry-after')) >= 1);
  });
});

test('keeps separate budgets per caller', async () => {
  let caller = 'a';
  const app = createApp({
    modules: [
      probeModule('rateLimit', async (limit: RateLimiter) => {
        await limit('signin');
        return 'ok';
      }),
    ],
    plugins: [rateLimit({ rules: RULES, keyOf: () => caller })],
  });

  await withApp(app, async () => {
    const hit = () => app.fetch(new Request('http://plugin.test/rateLimit/probe'));

    await hit();
    await hit();
    assert.equal((await hit()).status, 429);

    caller = 'b';
    assert.equal((await hit()).status, 200);
  });
});

test('a keyOf returning null exempts the request entirely', async () => {
  const app = createApp({
    modules: [
      probeModule('rateLimit', async (limit: RateLimiter) => {
        await limit('signin');
        return 'ok';
      }),
    ],
    plugins: [rateLimit({ rules: RULES, keyOf: () => null })],
  });

  await withApp(app, async () => {
    for (let i = 0; i < 5; i++) {
      assert.equal((await app.fetch(new Request('http://plugin.test/rateLimit/probe'))).status, 200);
    }
  });
});

test('names an unknown rule rather than silently allowing it', async () => {
  const app = createApp({
    modules: [
      probeModule('rateLimit', async (limit: RateLimiter) => {
        await limit('nope');
        return 'ok';
      }),
    ],
    plugins: [rateLimit({ rules: RULES })],
  });

  await withApp(app, async () => {
    assert.equal((await app.fetch(new Request('http://plugin.test/rateLimit/probe'))).status, 500);
  });
});

// Convention rule 2: the plugin's name, the node's name and the provided token are one string, so
// two instances collide on none of the three.
test('two instances with different provides both answer, without colliding', async () => {
  const app = createApp({
    modules: [probeModule('userLimit', () => 'user'), probeModule('adminLimit', () => 'admin')],
    plugins: [rateLimit({ rules: RULES, provides: 'userLimit' }), rateLimit({ rules: RULES, provides: 'adminLimit' })],
  });

  await withApp(app, async () => {
    assert.equal((await app.fetch(new Request('http://plugin.test/userLimit/probe'))).status, 200);
    assert.equal((await app.fetch(new Request('http://plugin.test/adminLimit/probe'))).status, 200);
  });
});

test('the plugin is named after what it provides', () => {
  assert.equal(rateLimit({ rules: RULES }).name, 'rateLimit');
  assert.equal(rateLimit({ rules: RULES, provides: 'adminLimit' }).name, 'adminLimit');
});
