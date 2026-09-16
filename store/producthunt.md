# Product Hunt launch kit

**Name:** Tab Doctor
**Tagline (60 max):** Closes duplicate tabs, snoozes the rest. Zero network calls.
**Topics:** Productivity, Chrome Extensions, Open Source, Privacy
**Pricing:** Free
**Links:** https://chromewebstore.google.com/detail/icackaepcncclahofahchfjmgjdjipoh · https://github.com/ChaituVR/tab-doctor

## Description (260 max)
Keeps Chrome tabs healthy: open a duplicate and it switches you to the tab you already had, untouched tabs fold into a collapsed Stale group, right-click → Snooze brings a tab back later today, tomorrow or any date. Undo anything. Offline, open source.

## Maker's first comment
Hey PH 👋 I built Tab Doctor because I kept ending up with 60 tabs, half of them duplicates of GitHub PRs and docs I'd already opened.

Three rules, nothing else:
• Open a duplicate and it just switches you to the tab you already had. Pin a tab to protect it; Undo or Recently closed if it ever bites.
• Stale tabs (24h untouched, adjustable) fold into a collapsed group. Click one, it pops back out.
• Right-click → Snooze → Later today / Tomorrow 9 AM / Weekend / pick a date. The tab comes back on its own.
• Optional: group tabs by site, unload week-old tabs to free RAM, ignore utm_ junk when comparing pages. Export/import a backup — import merges, never wipes.

The part I care most about: it makes zero network calls — the manifest's CSP is `default-src 'none'`, so it physically can't phone home. No content scripts, no host permissions, no analytics. Settings never leave your machine. Source is on GitHub if you want to check.

What rule should I add next? On the list: per-site exceptions, settings sync, a wake-up toast, Firefox.

## Launch checklist
- [x] Web Store listing live (PH needs a real install link)
- [x] Repo public (open-source angle is the hook)
- [x] Gallery: video first https://youtu.be/IfTwk-ZrhxE, then ph-thumbnail + 3 screenshots + marquee
- [ ] Launch Tue–Thu, 12:01 AM PT (12:31 PM IST)
- [ ] Reply to every comment for the first 6 hours
