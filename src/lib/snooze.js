export const SNOOZE_OPTIONS = [
  { id: 'later', title: 'Later today (6 hours)' },
  { id: 'tomorrow', title: 'Tomorrow (9 AM)' },
  { id: 'weekend', title: 'Weekend (Saturday 9 AM)' }
];

const HOUR = 60 * 60 * 1000;

export function computeWakeAt(kind, now = Date.now()) {
  const d = new Date(now);
  switch (kind) {
    case 'later':
      return now + 6 * HOUR;
    case 'tomorrow':
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.getTime();
    case 'weekend': {
      const daysUntilSat = ((6 - d.getDay()) + 7) % 7 || 7;
      d.setDate(d.getDate() + daysUntilSat);
      d.setHours(9, 0, 0, 0);
      return d.getTime();
    }
    default:
      throw new Error(`unknown snooze kind: ${kind}`);
  }
}

export function alarmName(id) {
  return `snooze:${id}`;
}

export async function listSnoozed() {
  const { snoozed } = await chrome.storage.local.get('snoozed');
  return snoozed || [];
}

export async function saveSnoozed(list) {
  await chrome.storage.local.set({ snoozed: list });
}

export async function addSnoozed(entry) {
  const list = await listSnoozed();
  list.push(entry);
  await saveSnoozed(list);
}

export async function removeSnoozed(id) {
  const list = await listSnoozed();
  const entry = list.find(e => e.id === id) || null;
  await saveSnoozed(list.filter(e => e.id !== id));
  return entry;
}
