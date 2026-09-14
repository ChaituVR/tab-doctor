# Chrome Web Store listing

**Name:** Tab Doctor
**Summary (132 chars max):** Keeps your tabs healthy — closes duplicates, tucks stale tabs away, snoozes tabs for later. 100% offline, zero tracking.
**Category:** Productivity → Tools
**Language:** English

## Description
Tab Doctor quietly keeps your browser tidy so you don't have to.

• Close duplicates — open a page you already have open and Tab Doctor switches you to the existing tab (or keeps the newest, your choice). It never pulls a tab out from under you: browse into a page that's open elsewhere and both stay, with a ×2 badge. Pin a tab to protect it. Undo, or reopen anything from Recently closed.
• Group stale tabs — tabs you haven't looked at in 24 hours (you choose) fold into a collapsed "Stale" group. Click one and it pops right back out.
• Snooze tabs — right-click any page → Snooze → Later today, Tomorrow 9 AM, the Weekend, or pick any date and time. The tab closes and reopens itself on time.
• Optional rules — group tabs by site into colour-coded groups; unload tabs untouched for days to free memory; ignore utm_/fbclid tracking parameters when comparing pages. All off by default.
• Pause anytime — one switch turns automation off. Full settings live in their own tab.
• Backup — export everything to a JSON file and import it anywhere. Import merges, never wipes.

Built to be boring about privacy:
• Zero network calls — the extension's security policy forbids them (default-src 'none').
• No content scripts, no host permissions — it never reads or touches page content.
• No accounts, no analytics, no remote config. Settings live only in your browser's local storage.
• Open source (MIT).

Permissions, honestly explained:
• tabs — read tab URLs/titles to find duplicates and stale tabs
• tabGroups — create the "Stale" and per-site groups
• alarms — hourly stale check and snooze timers
• contextMenus — the right-click Snooze menu
• storage — your settings, snoozed list and closed-tab history, local only

## Single purpose
Tab hygiene: closing duplicate tabs, grouping stale tabs, and snoozing tabs.

## Permission justifications (paste into the dashboard)
- tabs: Required to enumerate open tabs (URL, title, lastAccessed, pinned state) to detect duplicates and stale tabs, and to close/reopen tabs.
- tabGroups: Required to create and manage the collapsed "Stale" tab group and optional per-site groups.
- alarms: Required for the hourly stale-tab check and for snooze wake-up timers.
- contextMenus: Required to offer the "Snooze tab" entries in the page and toolbar-icon context menus.
- storage: Required to persist user settings, the list of snoozed tabs and the closed-tab history locally. No data leaves the device.
- Remote code: No. Host permissions: none.

## Privacy practices (dashboard answers)
- Does the extension collect user data? **No.**
- Data usage certification: not sold to third parties, not used for unrelated purposes, not used for creditworthiness/lending. (All "no" — no data is collected at all.)
- Privacy policy URL: link to PRIVACY.md in the repo (see below).
