import { LANGUAGE_OPTIONS } from '../lib/names.js';
import { $, getSettings, saveSettings, bindSwitch, bindActions, renderRules, renderSnoozed, renderHistory, refreshUndo, renderLastRun, exportBackup, importBackupFile } from '../ui/ui.js';

async function render() {
  const settings = await getSettings();
  $('paused').checked = settings.paused;
  $('sameWindowOnly').checked = settings.sameWindowOnly;
  $('staleHours').value = settings.staleHours;
  $('duplicateMode').value = settings.duplicateMode;
  $('ignoreTrackingParams').checked = settings.ignoreTrackingParams;
  $('holdOnNavigate').checked = settings.holdOnNavigate;
  $('discardHours').value = settings.discardHours;
  $('smartNames').checked = settings.smartNames;
  renderRules(settings, $('rules'));
  await renderLastRun();
  await refreshUndo($('undo'));
  await renderSnoozed($('snoozed'), { onChange: render });
  await renderHistory($('history'), { onChange: render });
}

const AI_STATUS = {
  available: 'Ready on this device.',
  downloadable: 'Model not downloaded yet.',
  downloading: 'Model downloading…',
  unavailable: 'Not supported on this device.'
};

async function aiAvailability() {
  if (typeof LanguageModel === 'undefined') return 'unavailable';
  return LanguageModel.availability(LANGUAGE_OPTIONS).catch(() => 'unavailable');
}

async function renderAiStatus() {
  const state = await aiAvailability();
  $('aiStatus').textContent = AI_STATUS[state] ?? '';
  $('aiDownload').hidden = state !== 'downloadable';
}

async function downloadModel() {
  $('aiDownload').disabled = true;
  try {
    const session = await LanguageModel.create({
      ...LANGUAGE_OPTIONS,
      monitor(m) { m.addEventListener('downloadprogress', e => { $('aiStatus').textContent = `Downloading… ${Math.round(e.loaded * 100)}%`; }); }
    });
    session.destroy();
  } catch (err) {
    $('aiStatus').textContent = `Download failed: ${err.message}`;
  } finally {
    $('aiDownload').disabled = false;
    await renderAiStatus();
  }
}

$('version').textContent = `v${chrome.runtime.getManifest().version}`;
bindSwitch('smartNames', 'smartNames');
$('aiDownload').addEventListener('click', downloadModel);
renderAiStatus();
bindSwitch('paused', 'paused');
bindSwitch('sameWindowOnly', 'sameWindowOnly');
bindSwitch('ignoreTrackingParams', 'ignoreTrackingParams');
bindSwitch('holdOnNavigate', 'holdOnNavigate');
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
