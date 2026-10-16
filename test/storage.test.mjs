import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeChrome } from './fakeChrome.mjs';
import { listHistory, addHistory, saveHistory, removeHistory, HISTORY_CAP } from '../src/lib/history.js';
import { listSnoozed, addSnoozed, removeSnoozed, saveSnoozed, alarmName, SNOOZE_OPTIONS } from '../src/lib/snooze.js';
import { getSettings, saveSettings, getLastClosed, setLastClosed, DEFAULTS } from '../src/lib/settings.js';

const entry = (i, over = {}) => ({ url: `https://a.com/${i}`, title: `A ${i}`, closedAt: 1000 + i, rule: 'close-duplicates', ...over });

test('history: empty by default, addHistory puts the newest batch first', async () => {
  fakeChrome();
  assert.deepEqual(await listHistory(), []);
  await addHistory([entry(1)]);
  await addHistory([entry(2), entry(3)]);
  assert.deepEqual((await listHistory()).map(e => e.closedAt), [1002, 1003, 1001]);
});

test('history: addHistory with nothing does not write', async () => {
  const { state } = fakeChrome();
  await addHistory([]);
  assert.equal('history' in state.local, false);
});

test('history: saveHistory caps the list at HISTORY_CAP', async () => {
  fakeChrome();
  await saveHistory(Array.from({ length: HISTORY_CAP + 25 }, (_, i) => entry(i)));
  const list = await listHistory();
  assert.equal(list.length, HISTORY_CAP);
  assert.equal(list[0].closedAt, 1000);
});

test('history: addHistory drops the oldest past the cap', async () => {
  fakeChrome();
  await saveHistory(Array.from({ length: HISTORY_CAP }, (_, i) => entry(i)));
  await addHistory([entry(9999)]);
  const list = await listHistory();
  assert.equal(list.length, HISTORY_CAP);
  assert.equal(list[0].closedAt, 1000 + 9999);
  assert.equal(list.at(-1).closedAt, 1000 + HISTORY_CAP - 2);
});

test('history: removeHistory matches on closedAt and url together', async () => {
  fakeChrome();
  await saveHistory([entry(1), entry(1, { url: 'https://b.com' }), entry(2)]);
  const removed = await removeHistory(1001, 'https://b.com');
  assert.equal(removed.url, 'https://b.com');
  assert.deepEqual((await listHistory()).map(e => e.url), ['https://a.com/1', 'https://a.com/2']);
});

test('history: removeHistory returns null and keeps the list when nothing matches', async () => {
  fakeChrome();
  await saveHistory([entry(1)]);
  assert.equal(await removeHistory(1001, 'https://nope.com'), null);
  assert.equal((await listHistory()).length, 1);
});

test('snooze: add, list, remove by id', async () => {
  fakeChrome();
  assert.deepEqual(await listSnoozed(), []);
  await addSnoozed({ id: 'a', url: 'https://a.com', wakeAt: 1 });
  await addSnoozed({ id: 'b', url: 'https://b.com', wakeAt: 2 });
  const removed = await removeSnoozed('a');
  assert.equal(removed.url, 'https://a.com');
  assert.deepEqual((await listSnoozed()).map(e => e.id), ['b']);
});

test('snooze: removing an unknown id returns null and changes nothing', async () => {
  fakeChrome();
  await saveSnoozed([{ id: 'a', url: 'https://a.com', wakeAt: 1 }]);
  assert.equal(await removeSnoozed('zzz'), null);
  assert.equal((await listSnoozed()).length, 1);
});

test('snooze: alarm names are prefixed and every option has a computable wake time', async () => {
  const { computeWakeAt } = await import('../src/lib/snooze.js');
  assert.equal(alarmName('123-4'), 'snooze:123-4');
  const now = Date.now();
  for (const opt of SNOOZE_OPTIONS) assert.ok(computeWakeAt(opt.id, now) > now, opt.id);
});

test('settings: defaults when nothing is stored', async () => {
  fakeChrome();
  assert.deepEqual(await getSettings(), DEFAULTS);
  assert.equal((await getSettings()).smartNames, false);
});

test('settings: saveSettings merges top-level and nested rule toggles', async () => {
  fakeChrome();
  await saveSettings({ staleHours: 5, rules: { 'group-by-site': true } });
  await saveSettings({ rules: { 'close-duplicates': false } });
  const s = await getSettings();
  assert.equal(s.staleHours, 5);
  assert.equal(s.rules['group-by-site'], true);
  assert.equal(s.rules['close-duplicates'], false);
  assert.equal(s.rules['group-stale'], true);
});

test('settings: stored values from an older version gain new defaults', async () => {
  const { state } = fakeChrome();
  state.local.settings = { staleHours: 12, rules: { 'close-duplicates': false } };
  const s = await getSettings();
  assert.equal(s.staleHours, 12);
  assert.equal(s.smartNames, false);
  assert.equal(s.holdOnNavigate, true);
  assert.equal(s.rules['discard-stale'], false);
});

test('settings: lastClosed round-trips and defaults to empty', async () => {
  fakeChrome();
  assert.deepEqual(await getLastClosed(), []);
  await setLastClosed([{ url: 'https://a.com' }]);
  assert.deepEqual(await getLastClosed(), [{ url: 'https://a.com' }]);
});
