// Side panel: shows the transliteration of the latest selection sent from a PDF (or anything pasted).
(() => {
  'use strict';

  const { transliterate } = globalThis.Kannaadi;
  const settings = { scheme: 'tanglish' };

  const $ = (sel) => document.querySelector(sel);
  const src = $('#src');
  const out = $('#out');

  function render() {
    out.textContent = transliterate(src.value, settings.scheme) || ' ';
  }

  function setText(text) {
    if (typeof text !== 'string' || !text) return;
    src.value = text;
    render();
  }

  chrome.storage.sync.get(settings, (stored) => {
    Object.assign(settings, stored);
    document.querySelector('input[name="scheme"][value="' + settings.scheme + '"]').checked = true;
    render();
  });

  chrome.storage.session.get('pdfSelection', (v) => setText(v && v.pdfSelection));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes.pdfSelection) setText(changes.pdfSelection.newValue);
    if (area === 'sync' && changes.scheme) {
      settings.scheme = changes.scheme.newValue;
      document.querySelector('input[name="scheme"][value="' + settings.scheme + '"]').checked = true;
      render();
    }
  });

  for (const radio of document.querySelectorAll('input[name="scheme"]')) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      settings.scheme = radio.value;
      chrome.storage.sync.set({ scheme: radio.value });
      render();
    });
  }

  src.addEventListener('input', render);

  $('#copy').addEventListener('click', async () => {
    const btn = $('#copy');
    try {
      await navigator.clipboard.writeText(out.textContent.trim());
      btn.textContent = 'Copied';
    } catch (_) {
      btn.textContent = 'Press Ctrl+C';
    }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1300);
  });
})();
