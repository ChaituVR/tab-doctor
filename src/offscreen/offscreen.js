import { LANGUAGE_OPTIONS, SYSTEM_PROMPT, buildPrompt } from '../lib/names.js';

async function suggestName(label, titles) {
  if (typeof LanguageModel === 'undefined') throw new Error('Prompt API not available in this Chrome');
  const availability = await LanguageModel.availability(LANGUAGE_OPTIONS);
  if (availability !== 'available') throw new Error(`model ${availability}`);
  const session = await LanguageModel.create({ ...LANGUAGE_OPTIONS, initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }] });
  try {
    return await session.prompt(buildPrompt(label, titles));
  } finally {
    session.destroy();
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen' || msg.type !== 'name-group') return false;
  suggestName(msg.label, msg.titles).then(name => sendResponse({ name })).catch(err => sendResponse({ error: String(err) }));
  return true;
});
