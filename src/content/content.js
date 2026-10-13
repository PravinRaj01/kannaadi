// Kannaadi content script: detects a Tamil selection, shows a glass icon / card, replaces text with undo.
(() => {
  'use strict';

  const K = globalThis.Kannaadi;
  if (!K || !K.transliterate) return;
  const { transliterate, hasTamil } = K;

  const settings = { scheme: 'tanglish', autoIcon: true };
  try {
    chrome.storage.sync.get(settings, (v) => { if (v) Object.assign(settings, v); });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      for (const key of Object.keys(changes)) if (key in settings) settings[key] = changes[key].newValue;
    });
  } catch (_) { /* extension was reloaded; this script is orphaned */ }

  let host = null;
  let shadow = null;
  let ready = Promise.resolve();
  let iconEl = null;
  let cardEl = null;
  let pillEl = null;
  let pillTimer = 0;
  let updateTimer = 0;
  let current = null;       // snapshot of the current Tamil selection
  let pointer = null;       // last mouseup position, used to anchor text-field selections
  let mouseDown = false;

  // ---------- host + shadow DOM ----------

  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = 'kannaadi-root';
    host.setAttribute('style',
      'all:initial!important;position:absolute!important;left:0!important;top:0!important;' +
      'width:0!important;height:0!important;z-index:2147483647!important;visibility:hidden!important;');
    shadow = host.attachShadow({ mode: 'closed' });

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('src/content/ui.css');
    ready = new Promise((resolve) => {
      const done = () => { host.style.setProperty('visibility', 'visible', 'important'); resolve(); };
      link.addEventListener('load', done);
      link.addEventListener('error', done);
    });
    shadow.appendChild(link);
    document.documentElement.appendChild(host);
    try { speechSynthesis.getVoices(); } catch (_) { /* voices load lazily */ }
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // Place `el` near a client-space anchor, clamped to the viewport, flipping above when there is no room below.
  function place(el, anchor, gap) {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const x = Math.min(Math.max(anchor.x + gap, 8), Math.max(8, vw - w - 8));
    let y = anchor.y + gap;
    if (y + h > vh - 8) y = Math.max(8, anchor.top - h - gap);
    el.style.left = Math.round(x + window.scrollX) + 'px';
    el.style.top = Math.round(y + window.scrollY) + 'px';
  }

  // ---------- selection ----------

  function isTextField(el) {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA') return true;
    return el.tagName === 'INPUT' && ['text', 'search', 'url', 'tel'].includes(el.type);
  }

  function snapshot() {
    const active = document.activeElement;
    if (isTextField(active)) {
      let start;
      let end;
      try { start = active.selectionStart; end = active.selectionEnd; } catch (_) { return null; }
      if (start == null || start === end) return null;
      const r = active.getBoundingClientRect();
      const p = pointer && Date.now() - pointer.t < 5000 ? pointer : { x: r.left + 12, y: r.bottom - 4 };
      return {
        kind: 'field', text: active.value.slice(start, end), el: active, start, end,
        anchor: { x: p.x, y: p.y, top: p.y },
      };
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0).cloneRange();
    const rects = range.getClientRects();
    const last = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    return {
      kind: 'range', text: sel.toString(), range,
      anchor: { x: last.right, y: last.bottom, top: last.top },
    };
  }

  function update() {
    if (mouseDown) return;
    const snap = snapshot();
    const ok = !!snap && hasTamil(snap.text);
    if (cardEl && !(ok && current && snap.text === current.text)) hideCard();
    if (ok) {
      current = snap;
      if (settings.autoIcon && !cardEl) showIcon(snap);
    } else {
      current = null;
      hideIcon();
    }
  }

  function scheduleUpdate(delay) {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(update, delay);
  }

  // ---------- icon ----------

  async function showIcon(snap) {
    ensureHost();
    await ready;
    if (current !== snap) return;
    hideIcon();
    iconEl = make('button', 'icon', 'க');
    iconEl.type = 'button';
    iconEl.title = 'Transliterate with Kannaadi';
    iconEl.setAttribute('aria-label', 'Transliterate selected Tamil text');
    iconEl.addEventListener('mousedown', (e) => e.preventDefault());   // keep the selection alive
    iconEl.addEventListener('click', () => showCard(snap));
    shadow.appendChild(iconEl);
    place(iconEl, snap.anchor, 6);
  }

  function hideIcon() {
    if (iconEl) { iconEl.remove(); iconEl = null; }
  }

  // ---------- card ----------

  function tamilVoice() {
    try { return speechSynthesis.getVoices().find((v) => /^ta([-_]|$)/i.test(v.lang)) || null; } catch (_) { return null; }
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) { /* fall through */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      shadow.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (_) { return false; }
  }

  function actionButton(label, title, onClick) {
    const b = make('button', 'btn', label);
    b.type = 'button';
    b.title = title;
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', onClick);
    return b;
  }

  async function showCard(snap) {
    ensureHost();
    await ready;
    hideIcon();
    hideCard();
    hidePill();

    const roman = transliterate(snap.text, settings.scheme);
    cardEl = make('div', 'card');
    cardEl.setAttribute('role', 'dialog');
    cardEl.setAttribute('aria-label', 'Kannaadi transliteration');

    const actions = make('div', 'actions');
    const copyBtn = actionButton('Copy', 'Copy the English letters', async () => {
      const ok = await copyText(roman);
      copyBtn.textContent = ok ? 'Copied' : 'Press Ctrl+C';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1300);
    });
    actions.append(copyBtn, actionButton('Replace', 'Replace the Tamil on the page with English letters', () => replace(snap)));
    const voice = tamilVoice();
    if (voice) {
      actions.append(actionButton('🔊', 'Hear the Tamil', () => {
        const u = new SpeechSynthesisUtterance(snap.text);
        u.lang = voice.lang;
        u.voice = voice;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      }));
    }
    actions.append(make('span', 'spacer'), actionButton('✕', 'Close', hideCard));

    cardEl.append(make('div', 'tamil', snap.text), make('div', 'roman', roman), actions);
    shadow.appendChild(cardEl);
    place(cardEl, snap.anchor, 8);
  }

  function hideCard() {
    if (cardEl) { cardEl.remove(); cardEl = null; }
    try { speechSynthesis.cancel(); } catch (_) { /* no speech support */ }
  }

  // ---------- replace + undo ----------

  function textNodesIn(range) {
    const root = range.commonAncestorContainer;
    if (root.nodeType === Node.TEXT_NODE) return [root];
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (range.intersectsNode(n)) nodes.push(n);
    return nodes;
  }

  function replace(snap) {
    let undo = null;

    if (snap.kind === 'field') {
      const el = snap.el;
      const original = el.value.slice(snap.start, snap.end);
      if (original === snap.text) {
        const out = transliterate(original, settings.scheme);
        el.setRangeText(out, snap.start, snap.end, 'select');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        undo = () => {
          el.setRangeText(original, snap.start, snap.start + out.length, 'select');
          el.dispatchEvent(new Event('input', { bubbles: true }));
        };
      }
    } else {
      const range = snap.range;
      const ops = [];
      for (const node of textNodesIn(range)) {
        const start = node === range.startContainer ? range.startOffset : 0;
        const end = node === range.endContainer ? range.endOffset : node.length;
        if (end <= start) continue;
        const original = node.data.slice(start, end);
        if (!hasTamil(original)) continue;
        ops.push({ node, start, original, out: transliterate(original, settings.scheme) });
      }
      if (ops.length) {
        for (const op of ops) op.node.replaceData(op.start, op.original.length, op.out);
        const parent = ops[0].node.parentElement;
        const editHost = parent && parent.closest('[contenteditable]:not([contenteditable="false"])');
        const notify = () => { if (editHost) editHost.dispatchEvent(new InputEvent('input', { bubbles: true })); };
        notify();
        undo = () => {
          for (const op of ops.slice().reverse()) {
            if (op.node.isConnected) op.node.replaceData(op.start, op.out.length, op.original);
          }
          notify();
        };
      }
    }

    hideCard();
    if (undo) showPill(undo, snap.anchor);
  }

  async function showPill(undo, anchor) {
    ensureHost();
    await ready;
    hidePill();
    pillEl = make('div', 'pill');
    const undoBtn = actionButton('Undo', 'Put the Tamil text back', () => { undo(); hidePill(); });
    pillEl.append(make('span', null, 'Replaced'), undoBtn);
    shadow.appendChild(pillEl);
    place(pillEl, anchor, 8);
    pillTimer = setTimeout(hidePill, 6000);
  }

  function hidePill() {
    clearTimeout(pillTimer);
    if (pillEl) { pillEl.remove(); pillEl = null; }
  }

  // ---------- wiring ----------

  const insideHost = (e) => !!host && e.composedPath().includes(host);

  document.addEventListener('mousedown', (e) => {
    if (insideHost(e)) return;
    mouseDown = true;
    hideCard();
    hideIcon();
  }, true);

  document.addEventListener('mouseup', (e) => {
    mouseDown = false;
    if (insideHost(e)) return;
    pointer = { x: e.clientX, y: e.clientY, t: Date.now() };
    scheduleUpdate(10);
  }, true);

  document.addEventListener('keyup', () => scheduleUpdate(10), true);
  document.addEventListener('selectionchange', () => scheduleUpdate(250));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hideCard(); hideIcon(); }
  }, true);

  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg || msg.type !== 'kannaadi:open') return;
      const snap = snapshot();
      if (snap && hasTamil(snap.text)) { current = snap; showCard(snap); }
    });
  } catch (_) { /* extension was reloaded */ }
})();
