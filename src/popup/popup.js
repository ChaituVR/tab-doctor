import { rules } from '../rules/index.js';
import { getSettings, saveSettings, getLastClosed } from '../lib/settings.js';
import { listSnoozed } from '../lib/snooze.js';

const $ = id => document.getElementById(id);
const send = (type, extra = {}) => chrome.runtime.sendMessage({ type, ...extra });

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function pill(text, onClick, quiet = false) {
  const b = el('button', quiet ? 'pill quiet' : 'pill', text);
  b.addEventListener('click', onClick);
  return b;
}

function setStatus(text) { $('status').textContent = text; }

function formatWhen(ts) {
  const d = new Date(ts);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return `Today, ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

async function refreshUndo() {
  const closed = await getLastClosed();
  $('undo').disabled = closed.length === 0;
  $('undo').textContent = closed.length ? `Undo (${closed.length})` : 'Undo';
}

function renderRules(settings) {
  const list = $('rules');
  list.replaceChildren();
  for (const rule of rules) {
    const row = el('li', 'row');
    const text = el('div', 'text');
    text.append(el('span', 'label', rule.name), el('span', 'sub', rule.description));
    const toggle = el('input', 'switch');
    toggle.type = 'checkbox';
    toggle.checked = settings.rules[rule.id] !== false;
    toggle.addEventListener('change', () => saveSettings({ rules: { [rule.id]: toggle.checked } }));
    row.append(text, toggle);
    list.append(row);
  }
}

async function renderSnoozed() {
  const list = $('snoozed');
  list.replaceChildren();
  const entries = (await listSnoozed()).sort((a, b) => a.wakeAt - b.wakeAt);
  if (!entries.length) {
    list.append(el('li', 'empty', 'Nothing snoozed. Right-click a page → Snooze tab.'));
    return;
  }
  for (const e of entries) {
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
    const open = pill('Open', async () => { await send('snooze-wake', { id: e.id }); await renderSnoozed(); });
    const forget = pill('✕', async () => { await send('snooze-cancel', { id: e.id }); await renderSnoozed(); }, true);
    forget.title = 'Forget this tab';
    pills.append(copy, open, forget);
    row.append(text, pills);
    list.append(row);
  }
}

async function render() {
  const settings = await getSettings();
  $('paused').checked = settings.paused;
  $('sameWindowOnly').checked = settings.sameWindowOnly;
  $('staleHours').value = settings.staleHours;
  renderRules(settings);

  const { lastRun } = await chrome.storage.local.get('lastRun');
  if (lastRun) setStatus(`Last run ${formatWhen(lastRun.at)} · closed ${lastRun.closed}, grouped ${lastRun.grouped || 0}`);
  await refreshUndo();
  await renderSnoozed();
}

$('paused').addEventListener('change', e => saveSettings({ paused: e.target.checked }));
$('sameWindowOnly').addEventListener('change', e => saveSettings({ sameWindowOnly: e.target.checked }));
$('staleHours').addEventListener('change', e => {
  const hours = Math.min(720, Math.max(1, Number(e.target.value) || 24));
  e.target.value = hours;
  saveSettings({ staleHours: hours });
});

$('run').addEventListener('click', async () => {
  setStatus('Running…');
  const res = await send('run-now');
  setStatus(res?.error ? `Error: ${res.error}` : `Closed ${res.closed} duplicate${res.closed === 1 ? '' : 's'}, grouped ${res.grouped} stale`);
  await refreshUndo();
});

$('undo').addEventListener('click', async () => {
  const res = await send('undo');
  setStatus(res?.error ? `Error: ${res.error}` : `Reopened ${res.reopened} tab${res.reopened === 1 ? '' : 's'}`);
  await refreshUndo();
});

render();
