// Forwards the keyboard shortcut and the context-menu click to the content script.
// Chrome's built-in PDF viewer cannot host content scripts, so there the result goes to the side panel instead.
const OPEN = { type: 'kannaadi:open' };
const PDF_VIEWER_ID = 'mhjfbmdgcfjbbpaeojofohoefgiehjai';

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function looksLikePdf(info, tab) {
  const urls = [info.frameUrl, info.pageUrl, tab && tab.url].filter(Boolean);
  return urls.some((u) => /\.pdf([?#]|$)/i.test(u) || u.includes(PDF_VIEWER_ID));
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'transliterate-selection') return;
  tab = tab || (await activeTab());
  // Goes to every frame; only the frame that holds a Tamil selection reacts.
  if (tab && tab.id != null) chrome.tabs.sendMessage(tab.id, OPEN).catch(() => {});
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'kannaadi',
      title: 'Transliterate with Kannaadi',
      contexts: ['selection'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'kannaadi' || !tab || tab.id == null) return;

  if (looksLikePdf(info, tab) && chrome.sidePanel) {
    // open() has to run inside the click handler to keep the user gesture, so it goes first.
    chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
    chrome.storage.session.set({ pdfSelection: info.selectionText || '', pdfAt: Date.now() });
    return;
  }
  chrome.tabs.sendMessage(tab.id, OPEN, { frameId: info.frameId }).catch(() => {});
});
