import { sampleTitles, cleanName, rememberName } from './names.js';

const OFFSCREEN_URL = 'src/offscreen/offscreen.html';
const TIMEOUT_MS = 15000;

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['WORKERS'],
    justification: "Chrome's built-in Prompt API (LanguageModel) is exposed to documents only, not to the extension service worker. The offscreen page runs Chrome's on-device model to name tab groups; nothing leaves the browser."
  }).catch(err => { if (!/single offscreen/i.test(String(err))) throw err; });
}

async function suggest(label, titles) {
  await ensureOffscreen();
  const reply = await Promise.race([
    chrome.runtime.sendMessage({ target: 'offscreen', type: 'name-group', label, titles }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), TIMEOUT_MS))
  ]);
  if (reply?.error) throw new Error(reply.error);
  return reply?.name;
}

/** Retitles freshly created site groups with the on-device model. Any failure leaves the label the rule set. */
export async function nameGroups(created) {
  for (const { groupId, label, tabs } of created) {
    const titles = sampleTitles(tabs);
    if (titles.length < 2) continue;
    try {
      const name = cleanName(await suggest(label, titles));
      if (!name || name.toLowerCase() === label.toLowerCase()) continue;
      await chrome.tabGroups.update(groupId, { title: name });
      await rememberName(label, name);
    } catch (err) {
      console.warn('[Tab Doctor] smart name skipped', label, err);
    }
  }
  await chrome.offscreen.closeDocument().catch(() => {});
}
