(() => {
  'use strict';

  const { transliterate } = globalThis.Kannaadi;
  const defaults = { scheme: 'tanglish', autoIcon: true, view: 'lens' };
  const settings = { ...defaults };

  const $ = (sel) => document.querySelector(sel);
  const input = $('#try');
  const out = $('#out');
  const hint = $('#hint');

  const HINTS = {
    tanglish: 'How people type Tamil: vanakkam, nandri, thamizh.',
    iso: 'Academic standard with diacritics: n with a dot below, a retroflex zh.',
  };

  function render() {
    out.textContent = transliterate(input.value, settings.scheme) || ' ';
    hint.textContent = HINTS[settings.scheme] || '';
  }

  function save(patch) {
    Object.assign(settings, patch);
    chrome.storage.sync.set(patch);
    render();
  }

  function say(text) {
    const el = $('#status');
    el.textContent = text;
    el.hidden = !text;
  }

  chrome.storage.sync.get(defaults, (stored) => {
    Object.assign(settings, stored);
    document.querySelector('input[name="scheme"][value="' + settings.scheme + '"]').checked = true;
    document.querySelector('input[name="view"][value="' + settings.view + '"]').checked = true;
    $('#autoIcon').checked = !!settings.autoIcon;
    render();
  });

  for (const radio of document.querySelectorAll('input[name="scheme"]')) {
    radio.addEventListener('change', () => { if (radio.checked) save({ scheme: radio.value }); });
  }
  for (const radio of document.querySelectorAll('input[name="view"]')) {
    radio.addEventListener('change', () => { if (radio.checked) save({ view: radio.value }); });
  }
  $('#autoIcon').addEventListener('change', (e) => save({ autoIcon: e.target.checked }));
  input.addEventListener('input', render);

  $('#restore').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id == null) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'kannaadi:restoreAll' });
      say('Restored the Tamil text on this page.');
    } catch (_) {
      say('Could not reach this page (try reloading it).');
    }
  });

  $('#sidepanel').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    } catch (_) {
      say('The side panel could not be opened here.');
    }
  });

  chrome.commands.getAll((commands) => {
    const cmd = commands.find((c) => c.name === 'transliterate-selection');
    const assigned = !!(cmd && cmd.shortcut);
    $('#kbd').textContent = assigned ? cmd.shortcut : 'Alt+Shift+T (page only)';
    $('#shortcuts').textContent = assigned ? 'Change' : 'Set shortcut';
    $('#shortcutNote').hidden = assigned;
  });
  $('#shortcuts').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
})();
