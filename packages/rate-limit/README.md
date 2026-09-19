# @green-tea/rate-limit

Publishes a per-request rate limiter into the graph. A handler opts in by asking for it and naming a
rule, so the limit is visible in the handler's signature rather than hidden in a middleware chain —
and green-tea runs the step only for the routes that depend on it.

## Runtimes

| Runtime | Supported | Why not |
|---|---|---|
| Node | ✅ | |
| Deno | ✅ | |
| Bun | ✅ | |
| workerd (edge) | ❌ | The default store counts per isolate, and an edge deployment has many, so a shared limit is not one. Supported once a store that shares state ships. |

## Usage

```ts
import { createApp } from '@green-tea/core';
import { rateLimit } from '@green-tea/rate-limit';

const app = createApp({
  modules: [AuthModule],
  plugins: [
    rateLimit({
      rules: {
        signin: { windowMs: 15 * 60 * 1000, max: 5, message: 'Too many attempts, try again later.' },
      },
    }),
  ],
});
```

```ts
@Post('/signin')
async signIn(@needs('rateLimit') limit: RateLimiter) {
  await limit('signin');
  // ...
}
```

Exceeding a rule throws a `429` carrying `Retry-After`. The error is recognised by green-tea through
a registered symbol rather than by extending its `HttpError`, so this package never imports core at
runtime.

## The store

The default `MemoryStore` keeps fixed windows in this process and sweeps expired ones on an interval.
**One process, one set of counters:** two replicas each enforce the limit separately, so the real
ceiling is `max × replicas`. Implement `RateLimitStore` against Redis when you scale past one.

The sweep timer keeps the process alive on purpose, and the plugin's `onShutdown` clears it. A custom
store owns its own lifecycle; `close()` is called on it if it has one.
