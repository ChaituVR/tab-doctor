import { rules } from '../rules/index.js';
import { getSettings, getLastClosed } from '../lib/settings.js';
import { listSnoozed } from '../lib/snooze.js';
import { listHistory, HISTORY_CAP } from '../lib/history.js';
import { serializeBackup } from '../lib/backup.js';

export const $ = id => document.getElementById(id);
export async function send(type, extra = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...extra });
  if (!response) throw new Error('Tab Doctor did not respond. Try reopening the extension.');
  if (response.error) throw new Error(response.error);
  return response;
}

export async function saveSettings(patch) {
  return (await send('save-settings', { patch })).settings;
}

export async function performAction(button, action) {
  if (button.dataset.pending) return;
  button.dataset.pending = 'true';
  button.disabled = true;
  try { return await action(); }
  catch (err) { setStatus(`Error: ${err.message}`); }
  finally {
    delete button.dataset.pending;
    button.disabled = false;
    if (button.id === 'undo') await refreshUndo(button).catch(err => setStatus(`Error: ${err.message}`));
  }
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function pill(text, onClick, quiet = false) {
  const b = el('button', quiet ? 'pill quiet' : 'pill', text);
  b.addEventListener('click', () => performAction(b, onClick));
  return b;
}

export function setStatus(text) {
  const s = $('status');
  if (s) s.textContent = text;
}

export function formatWhen(ts) {
  const d = new Date(ts);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return `Today, ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

export function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const RULE_LABEL = { 'close-duplicates': 'duplicate', 'group-stale': 'stale' };

export function openSettings(section) {
  if (typeof section === 'string') return chrome.tabs.create({ url: chrome.runtime.getURL(`src/options/options.html#${section}`) });
  return chrome.runtime.openOptionsPage();
}

export function bindSwitch(id, key) {
  bindSetting(id, key);
}

export function bindSetting(id, key, { rule = false, parse = value => value } = {}) {
  const input = $(id);
  input.addEventListener('change', async () => {
    const value = input.type === 'checkbox' ? input.checked : parse(input.value);
    input.disabled = true;
    let settings;
    try { settings = await saveSettings(rule ? { rules: { [key]: value } } : { [key]: value }); }
    catch (err) {
      setStatus(`Could not save: ${err.message}`);
      settings = await getSettings().catch(() => null);
    } finally { input.disabled = false; }
    if (settings) input[input.type === 'checkbox' ? 'checked' : 'value'] = rule ? settings.rules[key] : settings[key];
  });
}

export function renderRules(settings, listEl) {
  listEl.replaceChildren();
  for (const rule of rules) {
    const row = el('li', 'row');
    const text = el('div', 'text');
    text.append(el('span', 'label', rule.name), el('span', 'sub', rule.description));
    const toggle = el('input', 'switch');
    toggle.type = 'checkbox';
    toggle.id = `rule-${rule.id}`;
    toggle.setAttribute('aria-label', rule.name);
    toggle.checked = settings.rules[rule.id] !== false;
    row.append(text, toggle);
    listEl.append(row);
    bindSetting(toggle.id, rule.id, { rule: true });
  }
}

export async function renderSnoozed(listEl, { limit = Infinity, onChange } = {}) {
  const all = (await listSnoozed()).sort((a, b) => a.wakeAt - b.wakeAt);
  listEl.replaceChildren();
  if (!all.length) {
    listEl.append(el('li', 'empty', 'Nothing snoozed. Right-click a page → Snooze tab.'));
    return all.length;
  }
  for (const e of all.slice(0, limit)) {
    const row = el('li', 'row');
    const text = el('div', 'text');
    const title = el('span', 'label', e.title);
    title.title = e.url;
    text.append(title, el('span', 'sub', `Wakes ${formatWhen(e.wakeAt)}`));
    const pills = el('div', 'pills');
    const copy = pill('Copy', async () => {
      await navigator.clipboard.writeText(e.url);
      copy.textContent = 'Copied';
      setTimeout(() => (copy.textContent = 'Copy'), 1200);
    });
    const open = pill('Open', async () => { await send('snooze-wake', { id: e.id }); await onChange?.(); });
    const forget = pill('✕', async () => { await send('snooze-cancel', { id: e.id }); await onChange?.(); }, true);
    forget.title = 'Forget this tab';
    forget.setAttribute('aria-label', `Forget ${e.title}`);
    pills.append(copy, open, forget);
    row.append(text, pills);
    listEl.append(row);
  }
  if (all.length > limit) {
    const more = el('li', 'row footer');
    const link = el('button', 'link', `See all ${all.length} ↗`);
    link.addEventListener('click', () => openSettings('snooze'));
    more.append(el('span', '', ''), link);
    listEl.append(more);
  }
  return all.length;
}

export async function renderHistory(listEl, { limit = Infinity, onChange } = {}) {
  const entries = await listHistory();
  listEl.replaceChildren();
  if (!entries.length) {
    listEl.append(el('li', 'empty', 'Nothing closed yet.'));
    return 0;
  }
  for (const e of entries.slice(0, limit)) {
    const row = el('li', 'row');
    const text = el('div', 'text');
    const title = el('span', 'label', e.title);
    title.title = e.url;
    text.append(title, el('span', 'sub', `${ago(e.closedAt)} · ${RULE_LABEL[e.rule] || e.rule}`));
    const pills = el('div', 'pills');
    pills.append(pill('Reopen', async () => { await send('history-reopen', { closedAt: e.closedAt, url: e.url }); await onChange?.(); }));
    row.append(text, pills);
    listEl.append(row);
  }
  const footer = el('li', 'row footer');
  footer.append(el('span', '', `${entries.length} kept (last ${HISTORY_CAP})`));
  if (entries.length > limit) {
    const link = el('button', 'link', `See all ↗`);
    link.addEventListener('click', () => openSettings('recent'));
    footer.append(link);
  } else {
    const clear = el('button', 'link', 'Clear');
    clear.addEventListener('click', () => performAction(clear, async () => { await send('history-clear'); await onChange?.(); }));
    footer.append(clear);
  }
  listEl.append(footer);
  return entries.length;
}

export async function refreshUndo(btn) {
  const closed = await getLastClosed();
  btn.disabled = Boolean(btn.dataset.pending) || closed.length === 0;
  btn.textContent = closed.length ? `Undo (${closed.length})` : 'Undo';
}

export async function renderLastRun() {
  const { lastRun, lastError } = await chrome.storage.local.get(['lastRun', 'lastError']);
  if (lastError) { setStatus(`Error: ${lastError}`); return; }
  if (!lastRun) return;
  const parts = [['closed', lastRun.closed], ['grouped', lastRun.grouped], ['discarded', lastRun.discarded]]
    .filter(([, n]) => n > 0)
    .map(([verb, n]) => `${n} ${verb}`);
  setStatus(`Last run ${formatWhen(lastRun.at)} · ${parts.length ? parts.join(', ') : 'nothing to do'}`);
}

export function bindActions({ onChange }) {
  $('run').addEventListener('click', () => performAction($('run'), async () => {
    setStatus('Running…');
    const res = await send('run-now');
    await onChange?.();
    setStatus(`Closed ${res.closed} duplicate${res.closed === 1 ? '' : 's'}, grouped ${res.grouped} tab${res.grouped === 1 ? '' : 's'}${res.discarded ? `, unloaded ${res.discarded}` : ''}`);
  }));
  $('undo').addEventListener('click', () => performAction($('undo'), async () => {
    const res = await send('undo');
    await onChange?.();
    setStatus(`Reopened ${res.reopened} tab${res.reopened === 1 ? '' : 's'}`);
  }));
}

export async function exportBackup() {
  const { settings, snoozed, history } = await chrome.storage.local.get(['settings', 'snoozed', 'history']);
  const data = serializeBackup({ settings, snoozed, history });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tab-doctor-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  setStatus('Backup exported');
}

export async function importBackupFile(file, onChange) {
  try {
    const data = JSON.parse(await file.text());
    const res = await send('import', { data });
    await onChange?.();
    setStatus(`Imported: settings, ${res.snoozed} snoozed, ${res.history} history`);
  } catch (err) {
    setStatus(`Import failed: ${err.message}`);
  }
}

export { getSettings };
