# Tab Doctor — Privacy Policy

Tab Doctor does not collect, transmit, or share any data.

- It makes no network requests. Its Content Security Policy (`default-src 'none'`) makes network access technically impossible.
- It has no host permissions and no content scripts, so it never reads page content.
- The only data it stores lives in Chrome's local extension storage on your device: your settings, the list of snoozed tabs (URL, title, wake time), and the URLs and titles of tabs it closed ("Recently closed", last 500, clearable from Settings). Chrome Web Store classifies this as "web history"; it never leaves your device and is deleted when you uninstall the extension or clear the history.
- No accounts, no analytics, no crash reporting, no remote configuration.

Questions: open an issue on the GitHub repository.
