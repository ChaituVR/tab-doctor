import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeWakeAt } from '../src/lib/snooze.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0, 0, 0).getTime();
const local = ts => { const d = new Date(ts); return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]; };

test('tomorrow is always the next calendar day at 9:00, even late at night', () => {
  assert.deepEqual(local(computeWakeAt('tomorrow', at(2026, 9, 14, 23))), [2026, 9, 15, 9, 0]);
  assert.deepEqual(local(computeWakeAt('tomorrow', at(2026, 9, 14, 8))), [2026, 9, 15, 9, 0]);
  assert.deepEqual(local(computeWakeAt('tomorrow', at(2026, 12, 31, 20))), [2027, 1, 1, 9, 0]);
});

test('weekend is the coming Saturday 9:00, a full week when today is Saturday', () => {
  assert.deepEqual(local(computeWakeAt('weekend', at(2026, 9, 14))), [2026, 9, 19, 9, 0]);   // Monday → Saturday
  assert.deepEqual(local(computeWakeAt('weekend', at(2026, 9, 18))), [2026, 9, 19, 9, 0]);   // Friday → tomorrow
  assert.deepEqual(local(computeWakeAt('weekend', at(2026, 9, 19))), [2026, 9, 26, 9, 0]);   // Saturday → next Saturday
  assert.deepEqual(local(computeWakeAt('weekend', at(2026, 9, 20))), [2026, 9, 26, 9, 0]);   // Sunday → next Saturday
});

test('later is six hours from now, and unknown kinds throw', () => {
  const now = at(2026, 9, 14, 10);
  assert.equal(computeWakeAt('later', now), now + 6 * 60 * 60 * 1000);
  assert.throws(() => computeWakeAt('never', now));
});
