/** A single named limit: how many hits are allowed inside a window. */
export interface RateLimitRule {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum hits allowed per key inside the window. */
  max: number;
  /** Message returned in the 429 body. */
  message: string;
}

/** What a store reports back for one hit. */
export interface RateLimitHit {
  /** Hits recorded for this key inside the current window, including this one. */
  count: number;
  /** Epoch milliseconds at which the current window expires. */
  resetAt: number;
}

/**
 * Pluggable counter backend. The default is in-process memory; swap in Redis or Postgres by
 * implementing this and passing it to `rateLimit({ store })`.
 */
export interface RateLimitStore {
  /** Record one hit against `key` and return the resulting window state. */
  hit(key: string, windowMs: number): Promise<RateLimitHit> | RateLimitHit;
  /** Drop every counter. Used by tests and by operators clearing a lockout. */
  reset(): Promise<void> | void;
  /**
   * Release whatever the store holds open. Optional: a store that holds nothing needs none, and the
   * plugin's `onShutdown` calls it only if it exists.
   */
  close?(): Promise<void> | void;
}

/** The function a handler receives from `@needs('rateLimit')`. */
export type RateLimiter = (rule: string, override?: Partial<RateLimitRule>) => Promise<void>;

/** The slice of the green-tea request context this plugin reads. */
export interface RateLimitContext {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

export interface RateLimitOptions {
  /** Named rules, addressed by handlers as `limit('signin')`. */
  rules: Record<string, RateLimitRule>;
  /** Counter backend. Defaults to an in-process `MemoryStore`. */
  store?: RateLimitStore;
  /**
   * Derives the per-caller bucket from the request context. Defaults to `ctx.ip`.
   *
   * Returning `null` skips the limit for that request — use it to exempt health checks. Note that
   * `ctx.ip` is empty when the app is driven through `app.fetch()` rather than a socket, so the
   * default folds those into a single `unknown` bucket.
   */
  keyOf?: (ctx: RateLimitContext) => string | null;
  /** Graph name the limiter is published under, and the plugin's name. Defaults to `rateLimit`. */
  provides?: string;
}
