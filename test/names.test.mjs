import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, sampleTitles, buildPrompt } from '../src/lib/names.js';

test('cleanName: accepts short titles, strips wrapping and preamble', () => {
  assert.equal(cleanName('GitHub PRs'), 'GitHub PRs');
  assert.equal(cleanName('"Snapshot Work".'), 'Snapshot Work');
  assert.equal(cleanName('Tab group name: Dev Tools'), 'Dev Tools');
  assert.equal(cleanName('Sure, here is a name:\nSnapshot Governance'), 'Snapshot Governance');
  assert.equal(cleanName('**Node.js Docs**\n\nBecause the tabs are docs.'), 'Node.js Docs');
});

test('cleanName: rejects empty, long, odd or reserved replies', () => {
  assert.equal(cleanName(''), null);
  assert.equal(cleanName(undefined), null);
  assert.equal(cleanName('One Two Three Four'), null);
  assert.equal(cleanName('Supercalifragilisticexpialidocious Tabs'), null);
  assert.equal(cleanName('Stale'), null);
  assert.equal(cleanName('<script>'), null);
});

test('sampleTitles: dedupes, skips blanks and URL titles, caps the list', () => {
  const tabs = [
    { title: 'PR 1 · GitHub', url: 'https://github.com/1' },
    { title: 'pr 1 · github', url: 'https://github.com/1b' },
    { title: '', url: 'https://github.com/2' },
    { title: 'https://github.com/3', url: 'https://github.com/3' },
    { title: 'Issues · GitHub', url: 'https://github.com/4' }
  ];
  assert.deepEqual(sampleTitles(tabs), ['PR 1 · GitHub', 'Issues · GitHub']);
  assert.equal(sampleTitles(tabs, 1).length, 1);
});

test('buildPrompt: lists the site and every title', () => {
  const prompt = buildPrompt('github', ['A', 'B']);
  assert.match(prompt, /Site: github/);
  assert.match(prompt, /- A\n- B/);
});
