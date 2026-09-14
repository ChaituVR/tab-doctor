export const HISTORY_CAP = 500;

export async function listHistory() {
  const { history } = await chrome.storage.local.get('history');
  return history || [];
}

export async function saveHistory(list) {
  await chrome.storage.local.set({ history: list.slice(0, HISTORY_CAP) });
}

/** Newest first. Entries: { url, title, closedAt, rule }. */
export async function addHistory(entries) {
  if (!entries.length) return;
  const list = await listHistory();
  await saveHistory([...entries, ...list]);
}

export async function removeHistory(closedAt, url) {
  const list = await listHistory();
  const entry = list.find(e => e.closedAt === closedAt && e.url === url) || null;
  await saveHistory(list.filter(e => !(e.closedAt === closedAt && e.url === url)));
  return entry;
}
