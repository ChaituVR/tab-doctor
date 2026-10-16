import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rules } from '../src/rules/index.js';
import { isRestorableUrl } from '../src/lib/tabs.js';
import { DEFAULTS } from '../src/lib/settings.js';

const TRIGGERS = ['url-changed', 'tab-created', 'tab-removed', 'alarm', 'manual'];
const wait = ms => new Promise(r => setTimeout(r, ms));

test('rules registry: every rule has the full contract and a default toggle', () => {
  const ids = new Set();
  for (const rule of rules) {
    assert.equal(typeof rule.id, 'string');
    assert.ok(!ids.has(rule.id), `duplicate id ${rule.id}`);
    ids.add(rule.id);
    assert.ok(rule.name && rule.description, rule.id);
    assert.equal(typeof rule.run, 'function', rule.id);
    assert.ok(rule.triggers.length && rule.triggers.every(t => TRIGGERS.includes(t)), rule.id);
    assert.ok(rule.triggers.includes('manual'), `${rule.id} should run on Run Now`);
    assert.equal(typeof DEFAULTS.rules[rule.id], 'boolean', `${rule.id} missing from DEFAULTS.rules`);
  }
});

test('rules registry: duplicates close before stale grouping, which runs before site grouping', () => {
  const order = rules.map(r => r.id);
  assert.ok(order.indexOf('close-duplicates') < order.indexOf('group-stale'));
  assert.ok(order.indexOf('group-stale') < order.indexOf('group-by-site'));
});

test('isRestorableUrl: web pages and local files only', () => {
  assert.equal(isRestorableUrl('https://a.com/x'), true);
  assert.equal(isRestorableUrl('http://localhost:3000'), true);
  assert.equal(isRestorableUrl('file:///Users/me/a.html'), true);
  assert.equal(isRestorableUrl('chrome://extensions'), false);
  assert.equal(isRestorableUrl('javascript:alert(1)'), false);
  assert.equal(isRestorableUrl('not a url'), false);
  assert.equal(isRestorableUrl(undefined), false);
});
