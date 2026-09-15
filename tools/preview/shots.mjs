// Renders store screenshots and promo tiles from the real extension pages, with chrome.* stubbed
// and the manifest's CSP enforced (so an inline style that Chrome would block shows up here too).
// Usage: node tools/preview/shots.mjs [name…]      (no names = every shot)
// Needs Playwright with Chromium: `npx playwright install chromium` once, or a global install.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const OUT = path.join(ROOT, 'store');
const TOOLS = path.join(ROOT, 'tools/preview');
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const spec of ['playwright', 'playwright-core', process.env.PLAYWRIGHT_MODULE].filter(Boolean)) {
    try { return require(spec); } catch {}
  }
  throw new Error('playwright not found; npm i -g playwright or set PLAYWRIGHT_MODULE to its node_modules path');
})();
const manifest = JSON.parse(await readFile(path.join(ROOT, 'manifest.json'), 'utf8'));
const CSP = manifest.content_security_policy.extension_pages;

const TYPES = { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png', json: 'application/json' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const file = url.pathname.startsWith('/tools/') ? path.join(ROOT, url.pathname) : url.pathname.startsWith('/src/') || url.pathname.startsWith('/icons/') ? path.join(ROOT, url.pathname) : path.join(TOOLS, url.pathname);
  try {
    let body = await readFile(file);
    if (file.startsWith(path.join(ROOT, 'src')) && file.endsWith('.html')) body = Buffer.from(body.toString().replace('<meta charset="utf-8">', `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}">`));
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).slice(1)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const light = (name, src, w, ht, r, h, p, extra = {}) => ({ name, dark: false, src, w, ht, r, h, p, ...extra });
const SHOTS = [
  light('screenshot-1-light', '/src/popup/popup.html', 320, 640, 140, 'Tabs, kept healthy.', 'Duplicates close themselves. Stale tabs fold away. Snooze anything for later. Undo everything.', { fit: true }),
  { name: 'screenshot-2-dark', dark: true, src: '/src/options/options.html', w: 560, ht: 760, r: 80, h: 'Every rule, one switch.', p: 'Pause anytime. Pick which rules run, tune the timers, keep a backup. All in your own settings tab.' },
  light('screenshot-3-light', '/src/options/options.html', 560, 760, 80, 'Nothing leaves your browser.', 'No network calls, no content scripts, no accounts. Open source, MIT.', { scroll: true }),
  { name: 'promo-small', promo: 'small', w: 440, h: 280 },
  { name: 'promo-marquee', promo: 'marquee', w: 1400, h: 560 },
  { name: 'ph-thumbnail', promo: 'thumb', w: 240, h: 240 },
  // checks (not store assets): written to store/checks/
  light('checks/popup-empty-dark', '/src/popup/popup.html', 320, 640, 140, '', '', { fit: true, flags: { empty: true }, dark: true }),
  light('checks/popup-duplicate-light', '/src/popup/popup.html', 320, 640, 140, '', '', { fit: true, flags: { dup: true } }),
  light('checks/snooze-dark', '/src/snooze/snooze.html?tabId=1&title=refactor%3A%20prepare%20for%20Inco%20execution', 400, 300, 140, '', '', { fit: true, dark: true }),
];

const wanted = process.argv.slice(2);
const browser = await chromium.launch();
for (const s of SHOTS.filter(x => !wanted.length || wanted.includes(x.name))) {
  const ctx = await browser.newContext({ viewport: s.promo ? { width: s.w, height: s.h } : { width: 1280, height: 800 }, colorScheme: s.dark ? 'dark' : 'light' });
  await ctx.addInitScript(`window.__preview = ${JSON.stringify(s.flags || {})}`);
  await ctx.addInitScript({ path: path.join(TOOLS, 'stub.js') });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('  console error in', s.name + ':', m.text().slice(0, 140)); });
  const qs = new URLSearchParams({ src: s.src, w: s.w, ht: s.ht, r: s.r, h: s.h, p: s.p, ...(s.dark ? { dark: 1 } : {}) });
  await page.goto(s.promo ? `${base}/promo.html?kind=${s.promo}` : `${base}/compose.html?${qs}`);
  const frameEl = await page.$('iframe');
  const frame = frameEl ? await frameEl.contentFrame() : null;
  if (frame) await frame.waitForLoadState('load');
  await page.waitForTimeout(400);
  if (s.fit && frame) {
    const h = Math.min(780, await frame.evaluate(() => Math.ceil(document.body.getBoundingClientRect().bottom)));
    await page.evaluate(h => { const f = document.getElementById('f'); f.style.height = h + 'px'; f.style.top = ((800 - h) / 2) + 'px'; }, h);
  }
  if (s.scroll && frame) await frame.evaluate(() => document.scrollingElement.scrollTo(0, document.scrollingElement.scrollHeight));
  await page.waitForTimeout(250);
  const file = path.join(OUT, `${s.name}.png`);
  await page.screenshot({ path: file });
  console.log('wrote', path.relative(ROOT, file));
  await ctx.close();
}
await browser.close();
server.close();
