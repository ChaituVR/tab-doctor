# Chaitu Manager

Tab hygiene rules for Chrome, fully offline. Only the `tabs` permission — no host permissions, no content scripts, no storage; CSP `default-src 'none'` makes network access impossible.

## Rules
- **Close duplicate tabs** — same URL (ignoring `#hash`) open more than once: keep the newest, close the rest. Pinned and browser-internal tabs are never touched.

## Layout
```
src/background.js      event wiring → runs rules by trigger
src/rules/index.js     rule registry (add new rules here)
src/rules/*.js         one file per rule: { id, name, description, triggers, run(ctx) }
src/lib/               pure helpers (tabs, scheduler, badge)
test/                  node --test
```
Adding a feature = one new file in `src/rules/` + one line in `index.js`. `ctx` gives every rule the full tab list and the trigger (`url-changed`, `tab-created`, `tab-removed`, `manual`).

## Install
1. `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select this folder
3. Toolbar icon = run all rules now (badge shows tabs closed)

## Test
`node --test` (or `npm test`)
