import { $, send, getSettings, bindSwitch, bindActions, renderSnoozed, renderHistory, refreshUndo, renderLastRun, openSettings } from '../ui/ui.js';

let twin = null;

async function renderDuplicateBanner() {
  const status = await send('tab-status').catch(() => null);
  const twins = status?.twins || [];
  twin = twins[0] || null;
  $('dupBanner').hidden = !twin;
  if (!twin) return;
  $('dupLabel').textContent = twins.length === 1 ? 'Also open in another tab' : `Open in ${twins.length + 1} tabs`;
  $('dupSub').textContent = status.held ? 'Kept because you navigated here.' : 'Not closed by your current rules.';
}

async function render() {
  const settings = await getSettings();
  $('paused').checked = settings.paused;
  await renderDuplicateBanner();
  await renderLastRun();
  await refreshUndo($('undo'));
  await renderSnoozed($('snoozed'), { limit: 3, onChange: render });
  await renderHistory($('history'), { limit: 3, onChange: render });
}

bindSwitch('paused', 'paused');
bindActions({ onChange: render });
$('settings').addEventListener('click', openSettings);
$('snoozeNow').addEventListener('click', async () => { await send('snooze-picker'); window.close(); });
$('settings2').addEventListener('click', openSettings);
$('dupSwitch').addEventListener('click', async () => { if (twin) await send('activate-tab', { tabId: twin.id }); window.close(); });
$('dupClose').addEventListener('click', async () => { await send('close-tab'); window.close(); });
render();
