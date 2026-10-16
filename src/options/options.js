import { LANGUAGE_OPTIONS } from '../lib/names.js';
import { siteFromInput } from '../lib/tabs.js';
import { $, el, pill, saveSettings, getSettings, bindSwitch, bindSetting, bindActions, performAction, setStatus, renderSnoozed, renderHistory, refreshUndo, renderLastRun, exportBackup, importBackupFile } from '../ui/ui.js';

const sections = {
  care: ['Tab care', 'Small habits for a calmer browser.'],
  snooze: ['Snoozed tabs', 'Out of the way. Back when you need them.'],
  recent: ['Recently closed', 'A second chance for the tabs you want back.'],
  backup: ['Backup', 'Keep your setup close, wherever you go.'],
  about: ['About Tab Doctor', 'A little care for your everyday browser.']
};
const ruleInputs = [...document.querySelectorAll('[data-rule]')];

function renderLeaveAlone(sites) {
  const list = $('leaveAlone');
  list.replaceChildren();
  if (!sites.length) { list.append(el('li', 'empty', 'No sites yet. Every site gets the same care.')); return; }
  for (const site of sites) {
    const row = el('li', 'row');
    const text = el('div', 'text');
    text.append(el('span', 'label', site), el('span', 'sub', 'Never closed, grouped or unloaded'));
    const remove = pill('✕', () => saveSettings({ leaveAlone: sites.filter(s => s !== site) }), true);
    remove.setAttribute('aria-label', `Stop leaving ${site} alone`);
    row.append(text, remove);
    list.append(row);
  }
}

async function addLeaveAlone() {
  const site = siteFromInput($('leaveInput').value);
  if (!site) { setStatus('Enter a domain such as github.com'); return; }
  const { leaveAlone } = await getSettings();
  if (!leaveAlone.includes(site)) await saveSettings({ leaveAlone: [...leaveAlone, site] });
  $('leaveInput').value = '';
  setStatus(`Leaving ${site} alone`);
}

function showSection(shouldFocus = false) {
  const requested = location.hash.slice(1);
  const section = Object.hasOwn(sections, requested) ? requested : 'care';
  const [title, description] = sections[section];
  $('pageTitle').textContent = title;
  $('pageDescription').textContent = description;
  for (const pane of document.querySelectorAll('.pane')) pane.hidden = pane.id !== section;
  for (const link of document.querySelectorAll('nav a')) {
    if (link.hash === `#${section}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (shouldFocus) {
    $('settingsContent').scrollTo(0, 0);
    window.scrollTo(0, 0);
    $('pageTitle').focus({ preventScroll: true });
  }
}

async function render() {
  const settings = await getSettings();
  for (const id of ['paused', 'sameWindowOnly', 'ignoreTrackingParams', 'holdOnNavigate', 'smartNames']) if (!$(id).disabled) $(id).checked = settings[id];
  for (const id of ['staleHours', 'discardHours', 'duplicateMode']) if (!$(id).disabled && document.activeElement !== $(id)) $(id).value = settings[id];
  for (const input of ruleInputs) if (!input.disabled) input.checked = settings.rules[input.dataset.rule] !== false;
  document.querySelector('.care-status').classList.toggle('is-paused', settings.paused);
  $('careTitle').textContent = settings.paused ? 'Automatic care is paused' : 'Automatic care is on';
  $('careDescription').textContent = settings.paused ? 'Take your time. Resume whenever you’re ready.' : 'Running quietly in the background.';
  $('careIndicator').textContent = settings.paused ? 'Ⅱ' : '✓';
  await refreshUndo($('undo'));
  renderLeaveAlone(settings.leaveAlone);
  const count = await renderSnoozed($('snoozed'), { onChange: render });
  $('snoozeCount').textContent = count;
  $('snoozeCount').hidden = count === 0;
  await renderHistory($('history'), { onChange: render });
}

$('version').textContent = `Version ${chrome.runtime.getManifest().version}`;
for (const id of ['paused', 'sameWindowOnly', 'ignoreTrackingParams', 'holdOnNavigate', 'smartNames']) bindSwitch(id, id);

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

$('leaveAdd').addEventListener('click', () => performAction($('leaveAdd'), addLeaveAlone));
$('leaveInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); performAction($('leaveAdd'), addLeaveAlone); } });
$('aiDownload').addEventListener('click', () => performAction($('aiDownload'), async () => {
  const session = await LanguageModel.create({
    ...LANGUAGE_OPTIONS,
    monitor(m) { m.addEventListener('downloadprogress', e => { $('aiStatus').textContent = `Downloading… ${Math.round(e.loaded * 100)}%`; }); }
  });
  session.destroy();
  await renderAiStatus();
}));
renderAiStatus().catch(err => setStatus(`Error: ${err.message}`));
for (const input of ruleInputs) bindSetting(input.id, input.dataset.rule, { rule: true });
bindSetting('discardHours', 'discardHours', { parse: value => Math.min(8760, Math.max(1, Number(value) || 72)) });
bindSetting('staleHours', 'staleHours', { parse: value => Math.min(720, Math.max(1, Number(value) || 24)) });
bindSetting('duplicateMode', 'duplicateMode');
bindActions({ onChange: render });
$('export').addEventListener('click', () => performAction($('export'), exportBackup));
$('import').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', e => { if (e.target.files[0]) { const file = e.target.files[0]; performAction($('import'), () => importBackupFile(file, render)); } e.target.value = ''; });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (['settings', 'lastClosed', 'snoozed', 'history'].some(key => changes[key])) render().catch(err => setStatus(`Error: ${err.message}`));
  if (changes.lastError?.newValue) setStatus(`Error: ${changes.lastError.newValue}`);
});
window.addEventListener('hashchange', () => showSection(true));
showSection();
renderLastRun().catch(err => setStatus(`Error: ${err.message}`));
render().catch(err => setStatus(`Error: ${err.message}`));
