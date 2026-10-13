(() => {
  'use strict';

  const { transliterate } = globalThis.Kannaadi;
  const defaults = { scheme: 'tanglish', autoIcon: true };
  const settings = { ...defaults };

  const $ = (sel) => document.querySelector(sel);
  const input = $('#try');
  const out = $('#out');
  const hint = $('#hint');

  const HINTS = {
    tanglish: 'How people type Tamil: vanakkam, nandri, thamizh.',
    iso: 'Academic standard with diacritics: vanakkam with dots, tamil with a retroflex zh.',
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

  chrome.storage.sync.get(defaults, (stored) => {
    Object.assign(settings, stored);
    document.querySelector('input[name="scheme"][value="' + settings.scheme + '"]').checked = true;
    $('#autoIcon').checked = !!settings.autoIcon;
    render();
  });

  for (const radio of document.querySelectorAll('input[name="scheme"]')) {
    radio.addEventListener('change', () => { if (radio.checked) save({ scheme: radio.value }); });
  }
  $('#autoIcon').addEventListener('change', (e) => save({ autoIcon: e.target.checked }));
  input.addEventListener('input', render);

  chrome.commands.getAll((commands) => {
    const cmd = commands.find((c) => c.name === 'transliterate-selection');
    $('#kbd').textContent = cmd && cmd.shortcut ? cmd.shortcut : 'not set';
  });
  $('#shortcuts').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
})();
