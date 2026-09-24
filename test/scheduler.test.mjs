import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize } from '../src/lib/scheduler.js';

test('serialize: overlapping calls run one after another, in order, each with its own result', async () => {
  const log = [];
  const run = serialize(async name => {
    log.push(`start ${name}`);
    await new Promise(r => setTimeout(r, 5));
    log.push(`end ${name}`);
    return name;
  });
  const results = await Promise.all([run('a'), run('b')]);
  assert.deepEqual(results, ['a', 'b']);
  assert.deepEqual(log, ['start a', 'end a', 'start b', 'end b']);
});

test('serialize: a rejected run does not block the next one', async () => {
  const run = serialize(async ok => { if (!ok) throw new Error('boom'); return 'fine'; });
  await assert.rejects(run(false), /boom/);
  assert.equal(await run(true), 'fine');
});
