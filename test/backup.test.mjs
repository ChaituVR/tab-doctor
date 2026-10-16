import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeBackup, validateBackup, mergeHistory, mergeSnoozed, BACKUP_VERSION } from '../src/lib/backup.js';
import { DEFAULTS } from '../src/lib/settings.js';

const valid = over => ({ app: 'tab-doctor', version: BACKUP_VERSION, settings: {}, snoozed: [], history: [], ...over });

test('serializeBackup: stamps app/version/date and fills defaults', () => {
  const b = serializeBackup({ settings: { staleHours: 3 } });
  assert.equal(b.app, 'tab-doctor');
  assert.equal(b.version, BACKUP_VERSION);
  assert.ok(!Number.isNaN(Date.parse(b.exportedAt)));
  assert.equal(b.settings.staleHours, 3);
  assert.equal(b.settings.smartNames, DEFAULTS.smartNames);
  assert.deepEqual(b.snoozed, []);
  assert.deepEqual(b.history, []);
});

test('serialize → validate round-trips a full backup', () => {
  const snoozed = [{ id: 'x', url: 'https://a.com', title: 'A', kind: 'later', wakeAt: 5, snoozedAt: 1 }];
  const history = [{ url: 'https://b.com', title: 'B', closedAt: 9, rule: 'close-duplicates' }];
  const out = validateBackup(JSON.parse(JSON.stringify(serializeBackup({ settings: { staleHours: 7, smartNames: true }, snoozed, history }))));
  assert.equal(out.settings.staleHours, 7);
  assert.equal(out.settings.smartNames, true);
  assert.deepEqual(out.snoozed, snoozed);
  assert.deepEqual(out.history, history);
});

test('validateBackup: rejects wrong app, wrong version, non-objects', () => {
  assert.throws(() => validateBackup(null), /Not a Tab Doctor/);
  assert.throws(() => validateBackup('text'), /Not a Tab Doctor/);
  assert.throws(() => validateBackup({ app: 'other', version: 1 }), /Not a Tab Doctor/);
  assert.throws(() => validateBackup({ app: 'tab-doctor', version: 99 }), /Unsupported backup version 99/);
});

test('validateBackup: out-of-range numbers fall back to safe values', () => {
  const s = validateBackup(valid({ settings: { staleHours: 0, discardHours: 99999, duplicateMode: 'yolo' } })).settings;
  assert.equal(s.staleHours, 24);
  assert.equal(s.discardHours, 72);
  assert.equal(s.duplicateMode, 'keep-existing');
  const t = validateBackup(valid({ settings: { staleHours: '5', discardHours: -1 } })).settings;
  assert.equal(t.staleHours, 24);
  assert.equal(t.discardHours, 72);
});

test('validateBackup: boolean flags are coerced strictly', () => {
  const s = validateBackup(valid({ settings: { ignoreTrackingParams: 'yes', holdOnNavigate: 0 } })).settings;
  assert.equal(s.ignoreTrackingParams, false);
  assert.equal(s.holdOnNavigate, true);
  assert.equal(validateBackup(valid({ settings: { holdOnNavigate: false } })).settings.holdOnNavigate, false);
});

test('validateBackup: a non-object settings field becomes defaults', () => {
  assert.equal(validateBackup(valid({ settings: 'nope' })).settings.staleHours, DEFAULTS.staleHours);
});

test('validateBackup: drops snoozed entries without id, http(s) url or finite wakeAt', () => {
  const out = validateBackup(valid({ snoozed: [
    null, { id: 1, url: 'https://a.com', wakeAt: 1 }, { id: 'a', url: 'javascript:alert(1)', wakeAt: 1 },
    { id: 'b', url: 'https://b.com', wakeAt: 'soon' }, { id: 'c', url: 'https://c.com', wakeAt: 3 }
  ] }));
  assert.deepEqual(out.snoozed.map(e => e.id), ['c']);
  assert.equal(out.snoozed[0].title, 'https://c.com');
  assert.equal(out.snoozed[0].kind, 'later');
  assert.ok(Number.isFinite(out.snoozed[0].snoozedAt));
});

test('validateBackup: drops history without http(s) url or finite closedAt, strips extra fields', () => {
  const out = validateBackup(valid({ history: [
    { url: 'javascript:x', closedAt: 1 }, { url: 'https://a.com', closedAt: NaN },
    { url: 'https://b.com', closedAt: 2, evil: '<script>' }
  ] }));
  assert.deepEqual(out.history, [{ url: 'https://b.com', title: 'https://b.com', closedAt: 2, rule: 'unknown' }]);
});

test('validateBackup: file:// entries are kept, empty ids are dropped', () => {
  const out = validateBackup(valid({ snoozed: [{ id: '', url: 'https://a.com', wakeAt: 1 }, { id: 'f', url: 'file:///Users/me/a.html', wakeAt: 2 }], history: [{ url: 'file:///x', closedAt: 1 }] }));
  assert.deepEqual(out.snoozed.map(e => e.id), ['f']);
  assert.equal(out.history.length, 1);
});

test('validateBackup: non-array lists become empty', () => {
  const out = validateBackup(valid({ snoozed: {}, history: 'x' }));
  assert.deepEqual(out.snoozed, []);
  assert.deepEqual(out.history, []);
});

test('mergeHistory: union by closedAt+url, newest first, capped', () => {
  const a = { url: 'https://a.com', closedAt: 3 };
  const b = { url: 'https://b.com', closedAt: 2 };
  const c = { url: 'https://c.com', closedAt: 1 };
  assert.deepEqual(mergeHistory([a, c], [a, b]), [a, b, c]);
  assert.deepEqual(mergeHistory([a, c], [b], 2), [a, b]);
  assert.deepEqual(mergeHistory([], []), []);
});

test('mergeHistory: same time different url are both kept', () => {
  const out = mergeHistory([{ url: 'https://a.com', closedAt: 1 }], [{ url: 'https://b.com', closedAt: 1 }]);
  assert.equal(out.length, 2);
});

test('mergeSnoozed: union by id, incoming wins', () => {
  const out = mergeSnoozed([{ id: 'a', wakeAt: 1 }, { id: 'b', wakeAt: 2 }], [{ id: 'b', wakeAt: 20 }, { id: 'c', wakeAt: 3 }]);
  assert.deepEqual(out, [{ id: 'a', wakeAt: 1 }, { id: 'b', wakeAt: 20 }, { id: 'c', wakeAt: 3 }]);
});
