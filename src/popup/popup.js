import { $, send, getSettings, bindSwitch, bindActions, performAction, setStatus, renderSnoozed, renderHistory, refreshUndo, renderLastRun, openSettings } from '../ui/ui.js';

let twin = null;
let leaveBusy = false;

async function renderCareStatus() {
  const { paused } = await getSettings();
  if (!$('paused').disabled) $('paused').checked = paused;
  $('careStatus').classList.toggle('is-paused', paused);
  $('careTitle').textContent = paused ? 'Automatic care is paused' : 'Automatic care is on';
  $('careDescription').textContent = paused ? 'Resume whenever you’re ready.' : 'Keeping your tabs tidy.';
}

async function renderDuplicateBanner() {
  const status = await send('tab-status').catch(() => null);
  const twins = status?.twins || [];
  twin = twins[0] || null;
  $('dupBanner').hidden = !twin;
  if (!twin) return;
  $('dupLabel').textContent = twins.length === 1 ? 'Also open in another tab' : `Open in ${twins.length + 1} tabs`;
  $('dupSub').textContent = status.held ? 'Kept because you navigated here.' : 'Not closed by your current rules.';
}

async function renderLeaveCard() {
  const status = await send('tab-status').catch(() => null);
  $('leaveCard').hidden = !status?.site;
  if (!status?.site) return;
  $('leaveLabel').textContent = `Leave ${status.site} alone`;
  if (!leaveBusy) $('leaveSite').checked = status.leftAlone;
}

async function render() {
  await renderCareStatus();
  await renderDuplicateBanner();
  await renderLeaveCard();
  await renderLastRun();
  await refreshUndo($('undo'));
  const snoozed = await renderSnoozed($('snoozed'), { limit: 3, onChange: render });
  const history = await renderHistory($('history'), { limit: 3, onChange: render });
  $('snoozeCount').textContent = snoozed;
  $('snoozeCount').hidden = snoozed === 0;
  $('historyCount').textContent = history;
  $('historyCount').hidden = history === 0;
}

bindSwitch('paused', 'paused');
bindActions({ onChange: render });
$('settings').addEventListener('click', openSettings);
$('snoozeNow').addEventListener('click', () => performAction($('snoozeNow'), async () => { await send('snooze-picker'); window.close(); }));
$('settings2').addEventListener('click', openSettings);
$('dupSwitch').addEventListener('click', () => performAction($('dupSwitch'), async () => { if (twin) await send('activate-tab', { tabId: twin.id }); window.close(); }));
$('leaveSite').addEventListener('change', async () => {
  leaveBusy = true;
  $('leaveSite').disabled = true;
  try { await send('leave-site'); await render(); }
  catch (err) { setStatus(`Error: ${err.message}`); }
  finally { leaveBusy = false; $('leaveSite').disabled = false; }
});
$('dupClose').addEventListener('click', () => performAction($('dupClose'), async () => { await send('close-tab'); window.close(); }));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) renderCareStatus().catch(err => setStatus(`Error: ${err.message}`));
});
render().catch(err => setStatus(`Error: ${err.message}`));
