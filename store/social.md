# Launch-day posts (attach video/out/tab-doctor.mp4 to each)

## X — launch (post at 12:31 PM IST when the PH post is live)
I built a tiny Chrome extension because I kept ending up with 60 tabs, half of them the same page.

Tab Doctor:
• open a duplicate → it switches you to the tab you already had
• untouched tabs fold into a Stale group
• right-click → Snooze → back tomorrow 9 AM

Zero network calls. Open source.

Chrome Web Store: https://chromewebstore.google.com/detail/icackaepcncclahofahchfjmgjdjipoh
Product Hunt: <PH link>

## X — reply thread (post as a reply to the above)
The part I care about most: the manifest's CSP is `default-src 'none'`, so it physically can't phone home. No content scripts, no host permissions, no analytics. 1,200 lines of plain JS, no dependencies, 37 tests. https://github.com/ChaituVR/tab-doctor

## LinkedIn
I shipped a small thing: Tab Doctor, a Chrome extension that keeps tabs healthy.

Open a page you already have open and it just switches you to that tab. Tabs you haven't touched in a day fold into a collapsed group. Right-click any page → Snooze, and it comes back later today, tomorrow morning or on the weekend. Optional rules group tabs by site and unload old tabs to free memory.

It makes zero network calls (the security policy forbids them), has no content scripts and no analytics. Settings never leave your machine. Open source under MIT.

Free on the Chrome Web Store: https://chromewebstore.google.com/detail/icackaepcncclahofahchfjmgjdjipoh
Source: https://github.com/ChaituVR/tab-doctor

If you try it, I'd love to hear which rule you'd add next.

## Reddit (r/chrome_extensions, r/productivity) — title + body
Title: I made a fully offline tab-hygiene extension: closes duplicates, folds stale tabs, snoozes tabs (open source)
Body: same as LinkedIn, plus: "Happy to answer questions about the permissions — it only asks for tabs, tabGroups, alarms, contextMenus and storage, no host permissions."
