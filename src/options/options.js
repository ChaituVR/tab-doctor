import { $, getSettings, saveSettings, bindSwitch, bindActions, renderRules, renderSnoozed, renderHistory, refreshUndo, renderLastRun, exportBackup, importBackupFile } from '../ui/ui.js';

async function render() {
  const settings = await getSettings();
  $('paused').checked = settings.paused;
  $('sameWindowOnly').checked = settings.sameWindowOnly;
  $('staleHours').value = settings.staleHours;
  $('duplicateMode').value = settings.duplicateMode;
  $('ignoreTrackingParams').checked = settings.ignoreTrackingParams;
  $('discardHours').value = settings.discardHours;
  renderRules(settings, $('rules'));
  await renderLastRun();
  await refreshUndo($('undo'));
  await renderSnoozed($('snoozed'), { onChange: render });
  await renderHistory($('history'), { onChange: render });
}

$('version').textContent = `v${chrome.runtime.getManifest().version}`;
bindSwitch('paused', 'paused');
bindSwitch('sameWindowOnly', 'sameWindowOnly');
bindSwitch('ignoreTrackingParams', 'ignoreTrackingParams');
$('discardHours').addEventListener('change', e => {
  const hours = Math.min(8760, Math.max(1, Number(e.target.value) || 72));
  e.target.value = hours;
  saveSettings({ discardHours: hours });
});
$('staleHours').addEventListener('change', e => {
  const hours = Math.min(720, Math.max(1, Number(e.target.value) || 24));
  e.target.value = hours;
  saveSettings({ staleHours: hours });
});
$('duplicateMode').addEventListener('change', e => saveSettings({ duplicateMode: e.target.value }));
bindActions({ onChange: render });
$('export').addEventListener('click', exportBackup);
$('import').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', e => { if (e.target.files[0]) importBackupFile(e.target.files[0], render); e.target.value = ''; });
chrome.storage.onChanged.addListener(render);
render();
