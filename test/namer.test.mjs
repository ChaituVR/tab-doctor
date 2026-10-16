import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeChrome } from './fakeChrome.mjs';
import { nameGroups } from '../src/lib/namer.js';
import { groupNames, rememberName } from '../src/lib/names.js';

console.warn = () => {};

function withOffscreen(state, chrome, reply) {
  const calls = { created: 0, closed: 0, prompts: [] };
  let open = false;
  chrome.runtime.getContexts = async () => (open ? [{ contextType: 'OFFSCREEN_DOCUMENT' }] : []);
  chrome.offscreen = {
    createDocument: async opts => { calls.created++; calls.opts = opts; open = true; },
    closeDocument: async () => { calls.closed++; open = false; }
  };
  chrome.runtime.sendMessage = async msg => { calls.prompts.push(msg); return typeof reply === 'function' ? reply(msg) : reply; };
  return calls;
}

const created = (groupId, label, titles) => ({ groupId, label, tabs: titles.map((title, i) => ({ title, url: `https://${label}.com/${i}` })) });

test('nameGroups: retitles the group, caches the name, closes the offscreen page', async () => {
  const { state, chrome } = fakeChrome({ groups: [{ id: 5, title: 'github' }] });
  const calls = withOffscreen(state, chrome, { name: 'Snapshot PRs' });
  await nameGroups([created(5, 'github', ['PR 1', 'PR 2'])]);
  assert.equal(state.groups[0].title, 'Snapshot PRs');
  assert.deepEqual(await groupNames(), { github: 'Snapshot PRs' });
  assert.equal(calls.created, 1);
  assert.equal(calls.closed, 1);
  assert.deepEqual(calls.opts.reasons, ['WORKERS']);
  assert.equal(calls.opts.url, 'src/offscreen/offscreen.html');
  assert.deepEqual(calls.prompts[0], { target: 'offscreen', type: 'name-group', label: 'github', titles: ['PR 1', 'PR 2'] });
});

test('nameGroups: skips groups with fewer than two usable titles without asking the model', async () => {
  const { state, chrome } = fakeChrome({ groups: [{ id: 5, title: 'github' }] });
  const calls = withOffscreen(state, chrome, { name: 'X' });
  await nameGroups([created(5, 'github', ['Only one', ''])]);
  assert.equal(calls.prompts.length, 0);
  assert.equal(state.groups[0].title, 'github');
});

test('nameGroups: model errors, junk replies and label echoes keep the label', async () => {
  for (const reply of [{ error: 'model unavailable' }, { name: 'This is far too many words' }, { name: 'GitHub' }, {}, undefined]) {
    const { state, chrome } = fakeChrome({ groups: [{ id: 5, title: 'github' }] });
    withOffscreen(state, chrome, reply);
    await nameGroups([created(5, 'github', ['A', 'B'])]);
    assert.equal(state.groups[0].title, 'github', JSON.stringify(reply));
    assert.deepEqual(await groupNames(), {});
  }
});

test('nameGroups: one failing group does not stop the next, offscreen page is reused', async () => {
  const { state, chrome } = fakeChrome({ groups: [{ id: 5, title: 'github' }, { id: 6, title: 'notion' }] });
  const calls = withOffscreen(state, chrome, msg => (msg.label === 'github' ? { error: 'boom' } : { name: 'Team Wiki' }));
  await nameGroups([created(5, 'github', ['A', 'B']), created(6, 'notion', ['C', 'D'])]);
  assert.equal(state.groups[0].title, 'github');
  assert.equal(state.groups[1].title, 'Team Wiki');
  assert.equal(calls.created, 1);
});

test('nameGroups: a group closed before the reply arrives is skipped quietly', async () => {
  const { state, chrome } = fakeChrome({ groups: [] });
  withOffscreen(state, chrome, { name: 'Gone Group' });
  await nameGroups([created(5, 'github', ['A', 'B'])]);
  assert.deepEqual(await groupNames(), {});
});

test('nameGroups: an existing offscreen page is not created twice', async () => {
  const { state, chrome } = fakeChrome({ groups: [{ id: 5, title: 'github' }] });
  const calls = withOffscreen(state, chrome, { name: 'Code Review' });
  chrome.runtime.getContexts = async () => [{ contextType: 'OFFSCREEN_DOCUMENT' }];
  await nameGroups([created(5, 'github', ['A', 'B'])]);
  assert.equal(calls.created, 0);
  assert.equal(state.groups[0].title, 'Code Review');
});

test('rememberName: keeps other labels and overwrites the same one', async () => {
  fakeChrome();
  await rememberName('github', 'A');
  await rememberName('notion', 'B');
  await rememberName('github', 'C');
  assert.deepEqual(await groupNames(), { github: 'C', notion: 'B' });
});
