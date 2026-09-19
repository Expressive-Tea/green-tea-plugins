import type { RateLimitHit, RateLimitStore } from './types.ts';

/** Fallback sweep period, for a store built without rules to derive one from. */
const DEFAULT_SWEEP_MS = 60_000;

/**
 * Fixed-window counters held in this process.
 *
 * **One process, one set of counters.** Two replicas each enforce the limit separately, so the
 * effective ceiling is `max × replicas`. Implement `RateLimitStore` against Redis to share them.
 *
 * Expired windows are dropped by a timer rather than on the hot path. The version this replaces
 * walked the entire map from inside `hit()` whenever a key was new or expired — O(N²) over N
 * distinct callers, and a client rotating addresses drove it deliberately.
 */
export class MemoryStore implements RateLimitStore {
  private readonly windows = new Map<string, RateLimitHit>();
  private readonly sweepMs: number;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(options: { sweepMs?: number } = {}) {
    this.sweepMs = options.sweepMs ?? DEFAULT_SWEEP_MS;
  }

  /** How many windows are held. Lets a test assert the sweep without reaching inside. */
  get size(): number {
    return this.windows.size;
  }

  hit(key: string, windowMs: number): RateLimitHit {
    this.start();
    const now = Date.now();
    const current = this.windows.get(key);

    if (!current || current.resetAt <= now) {
      const fresh: RateLimitHit = { count: 1, resetAt: now + windowMs };
      this.windows.set(key, fresh);

      return fresh;
    }

    current.count += 1;

    return current;
  }

  reset(): void {
    this.windows.clear();
  }

  /** Stops the sweep. Safe to call twice — `close()` is reached more than once in real apps. */
  close(): void {
    if (!this.timer) return;

    clearInterval(this.timer);
    this.timer = undefined;
  }

  /**
   * Arms the sweep on the first hit, not in the constructor.
   *
   * A store built and never used holds nothing, and starting a timer for it would keep a process
   * alive over an empty map. Deliberately **not** `unref`ed: the timer is meant to hold the process
   * open, so that failing to release it is a visible bug rather than a silent leak, and so that all
   * three runtimes behave the same.
   */
  private start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => this.sweep(), this.sweepMs);
  }

  private sweep(): void {
    const now = Date.now();

    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(key);
    }
  }
}
