// Not a test — the child the exit test spawns. Named with a leading underscore so no runner picks it
// up: `node --test`, `deno test` and `bun test` all discover by filename, and this matches none.
//
// It boots an app that has taken a hit (so the sweep timer is armed), closes it, and prints one line.
// Nothing here calls process.exit: whether the process ends is the measurement.
import { createApp, Get, Module, Route, needs } from '@green-tea/core';

import { rateLimit } from '../src/index.ts';
import type { RateLimiter } from '../src/index.ts';

@Route('/')
class Probe {
  @Get('/probe')
  async probe(@needs('rateLimit') limit: RateLimiter) {
    await limit('signin');

    return { ok: true };
  }
}

@Module({ mountpoint: '/', controllers: [Probe] })
class ProbeModule {}

async function main(): Promise<void> {
  const app = createApp({
    modules: [ProbeModule],
    plugins: [rateLimit({ rules: { signin: { windowMs: 60_000, max: 10, message: 'too many' } } })],
  });

  await app.fetch(new Request('http://probe.test/probe'));
  await app.close();
  console.log('closed');
}

void main();
