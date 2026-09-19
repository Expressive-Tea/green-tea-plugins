import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { runtimeCommand } from './helpers.ts';

test('runtimeCommand names an executable and passes the script last', () => {
  const { command, args } = runtimeCommand('some/probe.ts');

  assert.ok(command.length > 0, 'no command');
  assert.equal(args.at(-1), 'some/probe.ts');
});
