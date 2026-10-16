import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQueue, debounce } from '../src/lib/scheduler.js';

const wait = ms => new Promise(r => setTimeout(r, ms));

test('createQueue: overlapping tasks run one after another, in order, each with its own result', async () => {
  const log = [];
  const enqueue = createQueue();
  const task = name => async () => { log.push(`start ${name}`); await wait(5); log.push(`end ${name}`); return name; };
  const results = await Promise.all([enqueue(task('a')), enqueue(task('b'))]);
  assert.deepEqual(results, ['a', 'b']);
  assert.deepEqual(log, ['start a', 'end a', 'start b', 'end b']);
});

test('createQueue: a rejected or throwing task does not block the next one', async () => {
  const enqueue = createQueue();
  await assert.rejects(enqueue(async () => { throw new Error('boom'); }), /boom/);
  await assert.rejects(enqueue(() => { throw new Error('sync'); }), /sync/);
  assert.equal(await enqueue(async () => 'fine'), 'fine');
});

test('debounce: a burst of calls runs once, then re-arms', async () => {
  let n = 0;
  const fn = debounce(() => { n++; }, 10);
  fn(); fn(); fn();
  await wait(30);
  assert.equal(n, 1);
  fn();
  await wait(30);
  assert.equal(n, 2);
});
