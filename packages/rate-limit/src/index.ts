import type { Plugin } from '@green-tea/core';

import { TooManyRequests } from './errors.ts';
import { MemoryStore } from './memory-store.ts';
import type { RateLimitContext, RateLimiter, RateLimitOptions, RateLimitRule } from './types.ts';

export { MemoryStore } from './memory-store.ts';
export { TooManyRequests } from './errors.ts';
export type {
  RateLimitContext,
  RateLimiter,
  RateLimitHit,
  RateLimitOptions,
  RateLimitRule,
  RateLimitStore,
} from './types.ts';

function defaultKeyOf(ctx: RateLimitContext): string {
  return ctx.ip !== undefined && ctx.ip !== '' ? ctx.ip : 'unknown';
}

/**
 * The sweep period for a store this plugin builds: the shortest window any rule configures.
 *
 * Sweeping less often than the shortest window would let a generation of expired counters sit in the
 * map for longer than they can possibly be useful, which is the growth the sweep exists to bound.
 */
function sweepPeriod(rules: Record<string, RateLimitRule>): number | undefined {
  const windows = Object.values(rules).map((rule) => rule.windowMs);

  return windows.length ? Math.min(...windows) : undefined;
}

/**
 * Publishes a per-request rate limiter into the graph.
 *
 * Rules live in one place; a handler opts in by asking for the limiter and naming a rule. Nothing is
 * enforced on routes that do not ask — green-tea runs a step only for the routes that depend on it —
 * so the limit is visible in the handler's signature rather than hidden in a middleware chain.
 *
 * The default store holds a sweep timer, which this releases in `onShutdown` (convention rule 7). A
 * store passed in owns its own lifecycle, and is closed only if it offers a `close()`.
 *
 * @example
 * const app = createApp({
 *   modules: [AuthModule],
 *   plugins: [rateLimit({ rules: { signin: { windowMs: 900_000, max: 5, message: 'too many' } } })],
 * });
 *
 * @example <caption>In a handler.</caption>
 * ⁣@Post('/signin')
 * async signIn(@needs('rateLimit') limit: RateLimiter) {
 *   await limit('signin');
 * }
 */
export function rateLimit(options: RateLimitOptions): Plugin {
  const provides = options.provides ?? 'rateLimit';
  const store = options.store ?? new MemoryStore({ sweepMs: sweepPeriod(options.rules) });
  const keyOf = options.keyOf ?? defaultKeyOf;

  const limiterFor = (ctx: RateLimitContext): RateLimiter => {
    return async (name, override) => {
      const configured = options.rules[name];
      if (!configured) throw new Error(`Unknown rate limit rule: "${name}"`);

      const rule: RateLimitRule = { ...configured, ...override };
      const bucket = keyOf(ctx);
      if (bucket === null) return;

      const { count, resetAt } = await store.hit(`${bucket}:${name}`, rule.windowMs);

      if (count > rule.max) {
        throw new TooManyRequests(rule.message, Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));
      }
    };
  };

  return {
    // Rule 2: plugin name, node name and provided token are one string. The original registered the
    // node as 'rate-limit' while providing 'rateLimit', so two instances shared a node name.
    name: provides,
    mount({ scope, onShutdown }) {
      scope.add({
        kind: 'step',
        name: provides,
        // `ip` and `headers` ride on the seed context rather than being graph nodes, so `req` is the
        // only declarable dependency here.
        needs: ['req'],
        provides: [provides],
        run: (ctx: RateLimitContext) => ({ [provides]: limiterFor(ctx) }),
      });

      onShutdown(() => store.close?.());
    },
  };
}
