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
