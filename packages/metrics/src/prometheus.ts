import type { TransformerFn } from '@green-tea/core';

/**
 * Serves a rendered scrape as the Prometheus text exposition format.
 *
 * A `TransformerFn` rather than a route: the path, the auth and whether the endpoint exists at all
 * are the application's decisions, and a plugin that mounted `/metrics` itself would be taking them.
 * The version is part of the content type — Prometheus reads it, and omitting it makes a scrape fall
 * back to a guess.
 *
 * @example
 * ⁣@Get('/metrics')
 * ⁣@Transformer(prometheus)
 * scrape(@needs('metrics') collector: Metrics) {
 *   return collector.render();
 * }
 */
export const prometheus: TransformerFn = (value) => ({
  status: 200,
  headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' },
  body: String(value),
});
