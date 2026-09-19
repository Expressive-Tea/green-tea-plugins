import type { Plugin } from '@green-tea/core';

import { Metrics } from './collector.ts';
import type { MetricsOptions } from './types.ts';

export { Metrics } from './collector.ts';
export { prometheus } from './prometheus.ts';
export type { MetricsOptions, MetricsSnapshot, Series } from './types.ts';

/**
 * Subscribes to the lifecycle stream and publishes the counters into the graph.
 *
 * There is no `onShutdown` (convention rule 7): a bus subscription is an entry in a set, and holds
 * no timer, socket or handle that could keep a process alive. Nothing to release.
 *
 * The collector is built at mount time rather than in the provider's `run`, because the subscription
 * has to exist before the first request — a provider runs on boot, which is late enough to miss it.
 *
 * @example
 * const app = createApp({ modules: [ApiModule], plugins: [metrics()] });
 *
 * @example <caption>Exposed on a route the application owns.</caption>
 * ⁣@Get('/metrics')
 * ⁣@Transformer(prometheus)
 * scrape(@needs('metrics') collector: Metrics) {
 *   return collector.render();
 * }
 */
export function metrics(options: MetricsOptions = {}): Plugin {
  const provides = options.provides ?? 'metrics';
  const collector = new Metrics();

  return {
    // Rule 2: plugin name, node name and provided token are one string.
    name: provides,
    mount({ bus, scope }) {
      bus.on('request:end', (payload) => collector.observeEnd(payload));
      bus.on('request:failed', (payload) => collector.observeFailure(payload));

      scope.add({
        kind: 'provider',
        name: provides,
        needs: [],
        provides: [provides],
        run: () => ({ [provides]: collector }),
      });
    },
  };
}
