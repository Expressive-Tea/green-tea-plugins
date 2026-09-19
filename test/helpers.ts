import { Get, Module, Route, needs } from '@green-tea/core';

/**
 * A module with one route, `GET /<token>/probe`, whose handler receives `@needs(token)` and answers
 * `{ value: await read(value) }`.
 *
 * It gives a plugin's node a consumer, which is how an application reaches it too — so a contract test
 * exercises the plugin through `createApp` and `app.fetch` rather than by calling `mount` by hand.
 * The token doubles as the mountpoint, so two probes for two instances of one plugin cannot collide.
 */
export function probeModule(token: string, read: (value: any) => unknown) {
  @Route('/')
  class Probe {
    @Get('/probe')
    async probe(@needs(token) value: unknown) {
      return { value: await read(value) };
    }
  }

  @Module({ mountpoint: `/${token}`, controllers: [Probe] })
  class ProbeModule {}

  return ProbeModule;
}

/** The globals each runtime defines, for picking the argv that re-runs a script under it. */
interface RuntimeGlobals {
  Deno?: { execPath(): string };
  Bun?: unknown;
  process?: { execPath: string };
}

/**
 * The command that runs `script` on whichever runtime is hosting this test.
 *
 * A contract file runs unchanged on three runtimes, so a test that spawns a child cannot hardcode
 * one. Deno needs its permission flag, Bun runs TypeScript directly, and Node needs tsx to load it.
 */
export function runtimeCommand(script: string): { command: string; args: string[] } {
  const globals = globalThis as RuntimeGlobals;

  // `--no-check` for the same reason `npm run test:deno` passes it: Deno type-checks the whole
  // reachable graph, which here reaches core's Node-only modules and their ambient `Buffer`. The
  // child is a runtime probe, and `npm run typecheck` already covers the types.
  if (globals.Deno) return { command: globals.Deno.execPath(), args: ['run', '--allow-all', '--no-check', script] };
  if (globals.Bun) return { command: 'bun', args: ['run', script] };

  return { command: globals.process!.execPath, args: ['--import', 'tsx', script] };
}
