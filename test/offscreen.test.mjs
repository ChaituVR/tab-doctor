import { test } from 'node:test';
import assert from 'node:assert/strict';

let listener;
const log = [];
globalThis.chrome = { runtime: { onMessage: { addListener: fn => { listener = fn; } } } };
await import('../src/offscreen/offscreen.js');

const ask = msg => new Promise(resolve => {
  const handled = listener(msg, {}, resolve);
  if (!handled) resolve('not-handled');
});

function model({ availability = 'available', reply = 'Dev Tools', fail } = {}) {
  globalThis.LanguageModel = {
    availability: async opts => { log.push(['availability', opts]); return availability; },
    create: async opts => {
      log.push(['create', opts]);
      return {
        prompt: async text => { log.push(['prompt', text]); if (fail) throw new Error(fail); return reply; },
        destroy: () => log.push(['destroy'])
      };
    }
  };
}

test('offscreen: ignores messages meant for someone else', async () => {
  assert.equal(await ask({ type: 'run-now' }), 'not-handled');
  assert.equal(await ask({ target: 'offscreen', type: 'other' }), 'not-handled');
});

test('offscreen: prompts the model with the system prompt and destroys the session', async () => {
  log.length = 0;
  model();
  assert.deepEqual(await ask({ target: 'offscreen', type: 'name-group', label: 'github', titles: ['A', 'B'] }), { name: 'Dev Tools' });
  const create = log.find(([k]) => k === 'create')[1];
  assert.equal(create.initialPrompts[0].role, 'system');
  assert.deepEqual(create.expectedOutputs, [{ type: 'text', languages: ['en'] }]);
  assert.match(log.find(([k]) => k === 'prompt')[1], /Site: github/);
  assert.equal(log.at(-1)[0], 'destroy');
});

test('offscreen: reports an error when the model is not ready, without creating a session', async () => {
  log.length = 0;
  model({ availability: 'downloadable' });
  assert.deepEqual(await ask({ target: 'offscreen', type: 'name-group', label: 'x', titles: ['A', 'B'] }), { error: 'Error: model downloadable' });
  assert.equal(log.some(([k]) => k === 'create'), false);
});

test('offscreen: still destroys the session when the prompt throws', async () => {
  log.length = 0;
  model({ fail: 'quota' });
  assert.deepEqual(await ask({ target: 'offscreen', type: 'name-group', label: 'x', titles: ['A', 'B'] }), { error: 'Error: quota' });
  assert.equal(log.at(-1)[0], 'destroy');
});

test('offscreen: missing Prompt API is a readable error', async () => {
  delete globalThis.LanguageModel;
  const res = await ask({ target: 'offscreen', type: 'name-group', label: 'x', titles: ['A', 'B'] });
  assert.match(res.error, /Prompt API not available/);
});
