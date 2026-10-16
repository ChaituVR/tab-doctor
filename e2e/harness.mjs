// Launches headless Chromium with the unpacked extension and a tiny local site to browse.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function launch() {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' }).end(`<!doctype html><title>${req.url}</title><h1>${req.url}</h1>`);
  }).listen(0);
  const port = server.address().port;
  const profile = mkdtempSync(path.join(os.tmpdir(), 'tab-doctor-e2e-'));
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: !process.env.HEADED,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`]
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const extId = sw.url().split('/')[2];
  // Right after start-up the worker exists before its chrome.* bindings and init() have finished.
  for (let i = 0; i < 100; i++) {
    const ready = await sw.evaluate(() => typeof chrome?.tabs?.query === 'function' && chrome.alarms.get('hourly').then(Boolean)).catch(() => false);
    if (ready) break;
    await new Promise(r => setTimeout(r, 100));
  }
  const h = {
    ctx, sw, extId, port,
    // Two hostnames for the same server so tests can treat them as two different sites.
    url: (p = '/') => `http://127.0.0.1:${port}${p}`,
    altUrl: (p = '/') => `http://localhost:${port}${p}`,
    ext: p => `chrome-extension://${extId}/${p}`,
    /** Runs fn inside the extension service worker. */
    inSw: (fn, arg) => sw.evaluate(fn, arg),
    openTab: (url, active = false) => sw.evaluate(u => chrome.tabs.create(u), { url, active }),
    tabs: () => sw.evaluate(() => chrome.tabs.query({})),
    siteTabs: () => sw.evaluate(() => chrome.tabs.query({ url: ['http://127.0.0.1/*', 'http://localhost/*'] })),
    groups: () => sw.evaluate(() => chrome.tabGroups.query({})),
    local: key => sw.evaluate(k => chrome.storage.local.get(k).then(r => r[k]), key),
    session: key => sw.evaluate(k => chrome.storage.session.get(k).then(r => r[k]), key),
    saveSettings: patch => sw.evaluate(async p => {
      const { settings = {} } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, ...p, rules: { ...(settings.rules || {}), ...(p.rules || {}) } } });
    }, patch),
    /** Polls until fn() is truthy; rejects with `what` after `ms`. */
    async until(fn, what, ms = 6000) {
      const end = Date.now() + ms;
      let last;
      while (Date.now() < end) {
        last = await fn();
        if (last) return last;
        await new Promise(r => setTimeout(r, 100));
      }
      throw new Error(`timed out waiting for ${what} (last value: ${JSON.stringify(last)})`);
    },
    /** Closes every tab on the local site and drops every group, so tests start clean. */
    async reset() {
      await sw.evaluate(async () => {
        const tabs = await chrome.tabs.query({ url: ['http://127.0.0.1/*', 'http://localhost/*'] });
        if (tabs.length) await chrome.tabs.remove(tabs.map(t => t.id));
        for (const p of await chrome.tabs.query({ url: 'chrome-extension://*/*' })) await chrome.tabs.remove(p.id).catch(() => {});
        await chrome.storage.local.remove(['lastError', 'lastClosed', 'history', 'snoozed', 'groupNames']);
        await chrome.storage.session.remove(['siteGroups', 'ownGroups', 'protectedTabs']);
      });
      await new Promise(r => setTimeout(r, 500));
    },
    async close() {
      await ctx.close();
      server.close();
      rmSync(profile, { recursive: true, force: true });
    }
  };
  return h;
}
