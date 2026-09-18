import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { Metrics } from '../src/collector.ts';

const end = (route: string, method: string, status: number, durationMs = 5) =>
  ({ name: route, route, method, status, durationMs }) as never;

test('counts one request per request:end, keyed by route, method and status', () => {
  const collector = new Metrics();

  collector.observeEnd(end('/users/:id', 'GET', 200));
  collector.observeEnd(end('/users/:id', 'GET', 200));
  collector.observeEnd(end('/users/:id', 'GET', 404));

  const { requests } = collector.snapshot();

  assert.equal(requests.find((s) => s.status === 200)?.value, 2);
  assert.equal(requests.find((s) => s.status === 404)?.value, 1);
});

// The defect issue #64 was filed for: a failed request emits request:start, request:failed and
// request:end. Counting the failure as a request reports one request as two.
test('a failure counts once as a request and once as an error, not twice as a request', () => {
  const collector = new Metrics();

  collector.observeFailure({ name: '/boom', route: '/boom', method: 'GET' } as never);
  collector.observeEnd(end('/boom', 'GET', 500));

  const { requests, errors } = collector.snapshot();

  assert.equal(
    requests.reduce((total, s) => total + s.value, 0),
    1,
  );
  assert.equal(
    errors.reduce((total, s) => total + s.value, 0),
    1,
  );
});

// Issue #65: `name` is the path that arrived and is bounded by nothing. `route` is the matched
// pattern, and is '<unmatched>' when nothing matched.
test('labels on the bounded route, so a scanner cannot mint a series per URL', () => {
  const collector = new Metrics();

  for (const probe of ['/aaa', '/aab', '/aac']) {
    collector.observeEnd({
      name: `GET ${probe}`,
      route: '<unmatched>',
      method: 'GET',
      status: 404,
      durationMs: 1,
    } as never);
  }

  const { requests } = collector.snapshot();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].route, '<unmatched>');
  assert.equal(requests[0].value, 3);
});

test('accumulates duration as a sum and a count, in seconds', () => {
  const collector = new Metrics();

  collector.observeEnd(end('/x', 'GET', 200, 1500));
  collector.observeEnd(end('/x', 'GET', 200, 500));

  const [duration] = collector.snapshot().duration;

  assert.equal(duration.count, 2);
  assert.equal(duration.sum, 2);
});

test('an event with no route is attributed rather than dropped or left blank', () => {
  const collector = new Metrics();

  collector.observeEnd({ name: 'GET /x', method: 'GET', status: 200, durationMs: 1 } as never);

  assert.equal(collector.snapshot().requests[0].route, '<unknown>');
});
