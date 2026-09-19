/**
 * Core's error brand, as the public protocol rather than as an import.
 *
 * `Symbol.for` is registry-wide, so this resolves to the same symbol core registered, in this copy
 * of the process and in any other. That is what lets a plugin throw something core renders without
 * depending on core at runtime — and it survives two copies of core in one tree, which `instanceof`
 * does not, since each copy has its own class identity.
 *
 * The string is the contract (design spec 1.2). `unique symbol` is what TypeScript needs for a
 * computed class field, and a `const` annotated with it satisfies that.
 */
const HTTP_ERROR: unique symbol = Symbol.for('green-tea.http-error');

/**
 * Thrown when a caller exceeds a rule. Carries `Retry-After` so a client can back off rather than
 * retry immediately and spend the next window too.
 *
 * Extends `Error`, not core's `HttpError`: core reads `status`, `message`, `body` and `headers` off
 * whatever carries the brand, and never uses `instanceof`.
 */
export class TooManyRequests extends Error {
  readonly [HTTP_ERROR] = true;
  readonly status = 429;
  readonly body: { message: string; status: number };
  readonly headers: Record<string, string>;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = 'TooManyRequests';
    this.body = { message, status: 429 };
    this.headers = { 'retry-after': String(retryAfterSeconds) };
  }
}
