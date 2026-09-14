# Tab Doctor 👨‍⚕️

[![tests](https://github.com/ChaituVR/tab-doctor/actions/workflows/test.yml/badge.svg)](https://github.com/ChaituVR/tab-doctor/actions/workflows/test.yml)

Tab hygiene rules for Chrome, fully offline. Only `tabs`, `tabGroups`, `alarms` (timers), `contextMenus` (snooze menu) + `storage` (local settings) permissions — no host permissions, no content scripts; CSP `default-src 'none'` makes network access impossible.

## Rules
- **Close duplicate tabs** — same URL (ignoring `#hash`) open more than once: keep one, close the rest. Setting: **switch to the tab you already had** (default) or keep the newest. Pinned and browser-internal tabs are never touched.
- **Group stale tabs** — tabs not viewed for N hours (default 24, set in popup) move into a collapsed **Stale** tab group per window; hourly + on Run now. Focusing a stale tab pulls it back out of the group.
- **Snooze tab** — right-click a page (or the toolbar icon) → *Snooze tab* → Later today (6h) / Tomorrow 9 AM / Weekend (Sat 9 AM) / **Pick date & time…** (a small calendar window; also reachable from the popup's *Snooze this tab*). The tab closes and reopens itself on time; the popup lists snoozed tabs with Copy link / Open now / forget.
- **Group tabs by site** (off by default) — two or more tabs from the same site get a colour-coded tab group (github, google…). Groups you made by hand are never touched; stale folding still works inside these.
- **Discard stale tabs** (off by default) — unload tabs untouched for N hours (default 72) from memory; they stay in the strip and reload on click.
- **Ignore tracking parameters** (off by default) — links differing only by `utm_*`, `fbclid`, `gclid`, `ref`… count as the same page for dedupe.
- **Recently closed** — every tab a rule closes is kept in a local history (last 500) with one-click Reopen, plus Undo for the whole last run.
- **Backup** — Export/Import a JSON file with settings, snoozed tabs and history. Import merges, never wipes.

## Popup + Settings tab
- Popup = the daily stuff: Pause, Run Now, Undo, top snoozed / recently closed. **All settings ↗** opens the full page in a tab.
- **Paused** switch (badge shows `II`), per-rule on/off, **Only same window** option (cross-window duplicates are usually intentional)
- **Run now** and **Undo last close** (reopens the tabs the last run closed)
- Pinned tabs are always exempt — pin a tab to keep a deliberate duplicate

## Layout
```
src/background.js      event wiring → runs rules by trigger
src/rules/index.js     rule registry (add new rules here)
src/rules/*.js         one file per rule: { id, name, description, triggers, run(ctx) }
src/lib/               pure helpers (tabs, settings, scheduler)
src/popup/             toolbar popup (quick actions)
src/options/           full settings page (opens in a tab)
src/ui/                shared UI helpers + stylesheet
src/snooze/            date & time picker window
test/                  node --test
```
Adding a feature = one new file in `src/rules/` + one line in `index.js`. `ctx` gives every rule the full tab list, settings, and the trigger (`url-changed`, `tab-created`, `tab-removed`, `alarm`, `manual`).

## Install
1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this folder
3. Toolbar icon opens the popup

## Test
`node --test` (or `npm test`)

## Promo video
`video/` is a [Remotion](https://remotion.dev) project (49 s, 1080p, fully mocked — no screen recording). The music bed is synthesized with numpy (`npm run music`), so there is nothing to license. Optional narration (off by default) comes from macOS `say`: run `npm run voice`, then set `NARRATION = true` in `src/Video.tsx`.
```
cd video && bun install && npm run studio   # preview
npm run render                               # → video/out/tab-doctor.mp4
```
