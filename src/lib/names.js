// Smart group names: what the on-device model is asked, how its reply becomes a title, and the label → name cache.
const KEY = 'groupNames';
const MAX_WORDS = 3;
const MAX_CHARS = 24;

export const LANGUAGE_OPTIONS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }]
};

export const SYSTEM_PROMPT = 'You name browser tab groups. Reply with only the name: 1 to 3 words, Title Case, no quotes, no punctuation, no explanation.';

export async function groupNames() {
  const { [KEY]: names } = await chrome.storage.local.get(KEY);
  return names || {};
}

export async function rememberName(label, name) {
  const names = await groupNames();
  if (names[label] === name) return;
  await chrome.storage.local.set({ [KEY]: { ...names, [label]: name } });
}

/** Titles worth showing the model: trimmed, deduped, no blanks or bare URLs, capped. */
export function sampleTitles(tabs, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const t of tabs) {
    const title = (t.title || '').trim();
    if (!title || title === t.url || /^https?:\/\//i.test(title)) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(title.slice(0, 120));
    if (out.length >= limit) break;
  }
  return out;
}

export function buildPrompt(label, titles) {
  return `Site: ${label}\nOpen tabs:\n${titles.map(t => `- ${t}`).join('\n')}\n\nName for this tab group:`;
}

/** Model reply → a usable group title, or null when it is not one. */
export function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  let line = (lines[0]?.endsWith(':') ? lines[1] : lines[0]) || '';
  if (line.includes(':')) line = line.slice(line.lastIndexOf(':') + 1);
  const name = line.replace(/["'“”‘’`*_]/g, '').replace(/[.!?,;]+$/, '').replace(/\s+/g, ' ').trim();
  const words = name.split(' ').filter(Boolean);
  if (!words.length || words.length > MAX_WORDS || name.length > MAX_CHARS) return null;
  if (!/^[\p{L}\p{N}&+./\- ]+$/u.test(name) || name.toLowerCase() === 'stale') return null;
  return name;
}
