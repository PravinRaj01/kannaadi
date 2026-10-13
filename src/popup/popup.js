(() => {
  'use strict';

  const { transliterate } = globalThis.Kannaadi;
  const defaults = { scheme: 'tanglish', autoIcon: true, view: 'lens' };
  const settings = { ...defaults };

  const $ = (sel) => document.querySelector(sel);
  const input = $('#try');
  const out = $('#out');

  // Words that come out differently in each style, so the cards show what you would get.
  const SAMPLE = 'அம்மா · பச்சை · நன்றி';

  function renderSamples() {
    for (const el of document.querySelectorAll('.sample')) {
      const text = SAMPLE.split(' · ').map((w) => transliterate(w, el.dataset.scheme)).join(' · ');
      el.textContent = text;
    }
  }

  function renderTry() {
    out.textContent = transliterate(input.value, settings.scheme) || ' ';
  }

  function check(name, value) {
    const el = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (el) el.checked = true;
  }

  function save(patch) {
    Object.assign(settings, patch);
    chrome.storage.sync.set(patch);
    renderTry();
  }

  function say(text) {
    const el = $('#status');
    el.textContent = text;
    el.hidden = !text;
  }

  chrome.storage.sync.get(defaults, (stored) => {
    Object.assign(settings, stored);
    check('scheme', settings.scheme);
    check('view', settings.view);
    $('#autoIcon').checked = !!settings.autoIcon;
    renderTry();
  });
  renderSamples();

  for (const radio of document.querySelectorAll('input[name="scheme"]')) {
    radio.addEventListener('change', () => { if (radio.checked) save({ scheme: radio.value }); });
  }
  for (const radio of document.querySelectorAll('input[name="view"]')) {
    radio.addEventListener('change', () => { if (radio.checked) save({ view: radio.value }); });
  }
  $('#autoIcon').addEventListener('change', (e) => save({ autoIcon: e.target.checked }));
  input.addEventListener('input', renderTry);

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
    $('#kbd').textContent = assigned ? cmd.shortcut : 'Alt+Shift+T';
    $('#shortcuts').textContent = assigned ? 'Change' : 'Set shortcut';
    $('#shortcutNote').hidden = assigned;
  });
  $('#shortcuts').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
})();
