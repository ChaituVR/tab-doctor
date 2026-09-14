export async function flashBadge(text, ms = 3000) {
  await chrome.action.setBadgeText({ text: String(text) });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), ms);
}
