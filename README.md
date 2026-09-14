# Tab Doctor 👨‍⚕️

Tab hygiene rules for Chrome, fully offline. Only `tabs`, `tabGroups`, `alarms` (timers), `contextMenus` (snooze menu) + `storage` (local settings) permissions — no host permissions, no content scripts; CSP `default-src 'none'` makes network access impossible.

## Rules
- **Close duplicate tabs** — same URL (ignoring `#hash`) open more than once: keep the newest, close the rest. Pinned and browser-internal tabs are never touched.
- **Group stale tabs** — tabs not viewed for N hours (default 24, set in popup) move into a collapsed **Stale** tab group per window; hourly + on Run now. Focusing a stale tab pulls it back out of the group.
- **Snooze tab** — right-click a page (or the toolbar icon) → *Snooze tab* → Later today (6h) / Tomorrow 9 AM / Weekend (Sat 9 AM). The tab closes and reopens itself on time; the popup lists snoozed tabs with Copy link / Open now / forget.

## Popup
- **Paused** switch (badge shows `II`), per-rule on/off, **Only same window** option (cross-window duplicates are usually intentional)
- **Run now** and **Undo last close** (reopens the tabs the last run closed)
- Pinned tabs are always exempt — pin a tab to keep a deliberate duplicate

## Layout
```
src/background.js      event wiring → runs rules by trigger
src/rules/index.js     rule registry (add new rules here)
src/rules/*.js         one file per rule: { id, name, description, triggers, run(ctx) }
src/lib/               pure helpers (tabs, settings, scheduler)
src/popup/             settings popup
test/                  node --test
```
Adding a feature = one new file in `src/rules/` + one line in `index.js`. `ctx` gives every rule the full tab list, settings, and the trigger (`url-changed`, `tab-created`, `tab-removed`, `alarm`, `manual`).

## Install
1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this folder
3. Toolbar icon opens the popup

## Test
`node --test` (or `npm test`)
