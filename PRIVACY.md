# Privacy Policy: Kannaadi

_Last updated: 13 October 2026_

Kannaadi is a browser extension that shows Tamil text in English letters. It was built to work entirely on your device.

## What Kannaadi collects

**Nothing.** Kannaadi does not collect, store on a server, sell, share or transmit any personal data, browsing history or page content. It makes **no network requests** and contains no analytics, advertising or tracking code.

## What happens to the text you select

Text you select is processed locally, inside your browser, by a small rule-based function. It is shown to you and is never sent anywhere.

## What is stored on your device

| Data | Where | Why |
| --- | --- | --- |
| Your settings: spelling style, lens or card view, whether the icon shows | Browser extension storage (`chrome.storage.sync`). If you are signed in to your browser, your browser may sync it between your devices, under your browser account's own sync | To remember your choices |
| The last Tamil text you selected in a PDF | Session storage (`chrome.storage.session`), kept in memory and cleared when the browser closes | To show it in the side panel |

Nothing else is stored.

## Permissions, and why they are needed

| Permission | Reason |
| --- | --- |
| Run on all websites (content script) | To notice when you select Tamil text on any page and to draw the lens or card over it. Kannaadi does not read or change pages beyond what you select, and only changes page text when you press **Replace**. |
| `storage` | To save the settings above. |
| `contextMenus` | To add the "Transliterate with Kannaadi" right-click item. |
| `sidePanel` | To show results for PDFs in the browser's side panel. |

## Support links

The popup contains links to Buy Me a Coffee and Ko-fi. They are ordinary links that open only when you click them. Those sites have their own privacy policies. Kannaadi shares nothing with them.

## Children

Kannaadi does not collect data from anyone, including children.

## Changes

If this policy changes, the updated version will be published in this file in the project repository, with a new date at the top.

## Contact

Questions or concerns: open an issue at https://github.com/PravinRaj01/kannaadi/issues
