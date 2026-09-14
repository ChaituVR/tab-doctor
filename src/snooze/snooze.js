import { $, el, setStatus, formatWhen } from '../ui/ui.js';
import { SNOOZE_OPTIONS, computeWakeAt } from '../lib/snooze.js';

const MIN_AHEAD = 60_000;
const params = new URLSearchParams(location.search);
const tabId = Number(params.get('tabId'));
$('tabTitle').textContent = params.get('title') || '';

function toLocalInput(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function untilText(ts) {
  const mins = Math.round((ts - Date.now()) / 60_000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}

function selectedWakeAt() {
  return new Date($('when').value).getTime();
}

function renderSummary() {
  const wakeAt = selectedWakeAt();
  $('summary').textContent = Number.isFinite(wakeAt) && wakeAt >= Date.now() + MIN_AHEAD
    ? `Wakes ${formatWhen(wakeAt)} · in ${untilText(wakeAt)}`
    : 'Pick a time at least a minute from now.';
}

function selectPreset(kind) {
  for (const seg of $('presets').children) seg.setAttribute('aria-checked', String(seg.dataset.kind === kind));
}

function setWakeAt(ts, kind = '') {
  $('when').value = toLocalInput(ts);
  selectPreset(kind);
  renderSummary();
}

async function fitWindow() {
  if (!chrome.windows?.getCurrent) return;
  const frame = Math.max(0, window.outerHeight - window.innerHeight) || 28;
  const height = Math.ceil(document.body.getBoundingClientRect().bottom) + frame;
  const win = await chrome.windows.getCurrent().catch(() => null);
  if (win && Math.abs(win.height - height) > 1) await chrome.windows.update(win.id, { height }).catch(() => {});
}

function showStatus(text) {
  setStatus(text);
  $('status').hidden = !text;
  fitWindow();
}

for (const opt of SNOOZE_OPTIONS) {
  const seg = el('button', 'seg', opt.title.replace(/ \(.*\)$/, ''));
  seg.type = 'button';
  seg.dataset.kind = opt.id;
  seg.setAttribute('role', 'radio');
  seg.addEventListener('click', () => setWakeAt(computeWakeAt(opt.id), opt.id));
  $('presets').append(seg);
}

$('when').min = toLocalInput(Date.now() + MIN_AHEAD);
$('when').addEventListener('input', () => { selectPreset(''); renderSummary(); });
setWakeAt(computeWakeAt('tomorrow'), 'tomorrow');

$('cancel').addEventListener('click', () => window.close());
$('snooze').addEventListener('click', async () => {
  const wakeAt = selectedWakeAt();
  if (!Number.isFinite(wakeAt) || wakeAt < Date.now() + MIN_AHEAD) {
    showStatus('Pick a time at least a minute from now.');
    return;
  }
  const res = await chrome.runtime.sendMessage({ type: 'snooze-custom', tabId, wakeAt });
  if (res?.error) { showStatus(`Error: ${res.error}`); return; }
  showStatus(`Snoozed until ${formatWhen(wakeAt)}`);
  setTimeout(() => window.close(), 600);
});

requestAnimationFrame(fitWindow);
