import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { TooManyRequests } from '../src/errors.ts';
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
