import { $, send, getSettings, bindSwitch, bindActions, renderSnoozed, renderHistory, refreshUndo, renderLastRun, openSettings } from '../ui/ui.js';

async function render() {
  const settings = await getSettings();
  $('paused').checked = settings.paused;
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
render();
