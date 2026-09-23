<p align="center">
  <img src="https://raw.githubusercontent.com/Expressive-Tea/green-tea/main/assets/logo.png" width="96" alt="Green Tea" />
</p>

<h1 align="center">@green-tea/metrics</h1>

<p align="center"><b>Count the lifecycle. Render Prometheus.</b></p>

<p align="center">
  Reads the event stream green-tea already emits, so nothing in your<br />
  handlers has to know it is being measured.
</p>

---

Subscribes to green-tea's lifecycle stream and counts what happened. You expose it on a route you
own, with the transformer this package ships.

## Runtimes

| Runtime | Supported | Why not |
|---|---|---|
| Node | ✅ | |
| Deno | ✅ | |
| Bun | ✅ | |
| workerd (edge) | ❌ | Counters live in one isolate, and an edge deployment has many, so a scrape reports whichever isolate answered it. Supported once the counters can be shared. |

## Install

```bash
npx jsr add @green-tea/metrics
```

Or `deno add jsr:@green-tea/metrics`, or `bunx jsr add @green-tea/metrics`. Under npm, yarn and pnpm
`jsr add` installs through `npm.jsr.io`, so the import below stays `@green-tea/metrics`.
There is no npmjs.org package — `npm i @green-tea/metrics` will not find one.

## Usage

```ts
import { createApp } from '@green-tea/core';
import { metrics } from '@green-tea/metrics';

const app = createApp({ modules: [ApiModule], plugins: [metrics()] });
```

```ts
import { prometheus, type Metrics } from '@green-tea/metrics';

@Get('/metrics')
@Transformer(prometheus)
scrape(@needs('metrics') metrics: Metrics) {
  return metrics.render();
}
```

The route is yours, so its path, its auth and whether it is exposed at all stay your decisions.

## What it counts, and what it refuses to

One failed request emits **three** lifecycle events, and a collector that counts them as three
outcomes reports one request as several. The division this package follows:

| Series | From | Meaning |
|---|---|---|
| `green_tea_requests_total` | `request:end` | Every dispatched request. Terminal and universal — this is *the* request counter |
| `green_tea_request_errors_total` | `request:failed` | Handler code threw. **Additional** to the request above, never a second request |
| `green_tea_request_duration_seconds` | `request:end` | Sum and count, so an average is available without buckets |

Labels are `route`, `method` and `status` — never the event's `name`. `route` is the matched
*pattern* and is bounded by your route table (`<unmatched>` when nothing matched); `name` carries the
path that arrived, which is bounded by nothing, so a scanner walking `/aaa`, `/aab`, `/aac` would
mint a label per URL. That is a memory leak with a metrics backend attached.
