// Forwards the keyboard shortcut and the context-menu click to the content script.
const OPEN = { type: 'kannaadi:open' };

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
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
  chrome.tabs.sendMessage(tab.id, OPEN, { frameId: info.frameId }).catch(() => {});
});
