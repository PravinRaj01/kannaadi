// Kannaadi content script: Tamil selection -> glass icon -> lens / card, plus replace with per-word restore.
(() => {
  'use strict';

  const K = globalThis.Kannaadi;
  if (!K || !K.transliterate) return;
  const { transliterate, hasTamil, splitTamil } = K;

  const settings = { scheme: 'tanglish', autoIcon: true, view: 'lens' };
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
  let viewEl = null;        // card or lens wrapper (only one at a time)
  let lensState = null;     // {snap, wrap, body, bar} while a lens is open
  let pillEl = null;
  let pillTimer = 0;
  let chipEl = null;
  let chipWord = null;
  let chipShowTimer = 0;
  let chipHideTimer = 0;
  let updateTimer = 0;
  let layoutFrame = 0;
  let lastOpen = 0;
  let current = null;       // snapshot of the current Tamil selection
  let pointer = null;       // last mouseup position, used to anchor text-field selections
  let mouseDown = false;

  const PAD_X = 8;          // how far the lens extends past the selected text, sideways
  const PAD_Y = 10;         // ... and up/down (line boxes are taller than the glyph rectangles)

  // ---------- host + shadow DOM ----------

  function loadCss() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'kannaadi:css' }, (res) => {
          void chrome.runtime.lastError;
          resolve((res && res.css) || '');
        });
      } catch (_) { resolve(''); }
    });
  }

  function ensureHost() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = 'kannaadi-root';
    host.setAttribute('style',
      'all:initial!important;position:absolute!important;left:0!important;top:0!important;' +
      'width:0!important;height:0!important;z-index:2147483647!important;visibility:hidden!important;');
    shadow = host.attachShadow({ mode: 'closed' });

    // The stylesheet comes through the background worker and is applied as a constructed sheet: a <link> to
    // chrome-extension:// is refused on some pages (YouTube), and a <style> can be blocked by page CSP.
    const target = host;
    ready = loadCss().then((css) => {
      try {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        shadow.adoptedStyleSheets = [sheet];
      } catch (_) { /* unstyled is better than broken */ }
      target.style.setProperty('visibility', 'visible', 'important');
    });
    document.documentElement.appendChild(host);
    try { speechSynthesis.getVoices(); } catch (_) { /* voices load lazily */ }
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function setPos(el, clientX, clientY) {
    el.style.left = Math.round(clientX + window.scrollX) + 'px';
    el.style.top = Math.round(clientY + window.scrollY) + 'px';
  }

  // Below a client-space anchor, clamped to the viewport; flips above when there is no room.
  function place(el, anchor, gap) {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const x = Math.min(Math.max(anchor.x + gap, 8), Math.max(8, vw - w - 8));
    let y = anchor.y + gap;
    if (y + h > vh - 8) y = Math.max(8, anchor.top - h - gap);
    setPos(el, x, y);
  }

  // Above a client rect (used by the restore chip); falls below when there is no room.
  function placeAbove(el, rect) {
    const vw = document.documentElement.clientWidth;
    const x = Math.min(Math.max(rect.left, 8), Math.max(8, vw - el.offsetWidth - 8));
    let y = rect.top - el.offsetHeight - 6;
    if (y < 8) y = rect.bottom + 6;
    setPos(el, x, y);
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
    const sel = window.getSelection();
    if (host && sel && sel.anchorNode === host) return;   // selecting inside our own UI
    const snap = snapshot();
    const ok = !!snap && hasTamil(snap.text);
    if (viewEl && !(ok && current && snap.text === current.text)) hideView();
    if (ok) {
      current = snap;
      if (settings.autoIcon && !viewEl) showIcon(snap);
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
    iconEl.addEventListener('click', () => openView(snap));
    shadow.appendChild(iconEl);
    place(iconEl, snap.anchor, 6);
  }

  function hideIcon() {
    if (iconEl) { iconEl.remove(); iconEl = null; }
  }

  // ---------- shared button helpers ----------

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

  function copyButton(roman) {
    const b = actionButton('Copy', 'Copy the English letters', async () => {
      const ok = await copyText(roman);
      b.textContent = ok ? 'Copied' : 'Press Ctrl+C';
      setTimeout(() => { b.textContent = 'Copy'; }, 1300);
    });
    return b;
  }

  function speakButton(snap) {
    const voice = tamilVoice();
    if (!voice) return null;
    return actionButton('🔊', 'Hear the Tamil', () => {
      const u = new SpeechSynthesisUtterance(snap.text);
      u.lang = voice.lang;
      u.voice = voice;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    });
  }

  // ---------- views: lens (default) and card ----------

  function openView(snap) {
    const now = Date.now();
    if (now - lastOpen < 300) return;   // the shortcut can arrive twice (command + page fallback)
    lastOpen = now;
    if (settings.view === 'lens' && snap.kind === 'range') showLens(snap);
    else showCard(snap);
  }

  function hideView() {
    if (viewEl) { viewEl.remove(); viewEl = null; }
    lensState = null;
    try { speechSynthesis.cancel(); } catch (_) { /* no speech support */ }
  }

  async function showCard(snap) {
    ensureHost();
    await ready;
    hideIcon();
    hideView();
    hidePill();
    hideChip();

    const roman = transliterate(snap.text, settings.scheme);
    const card = make('div', 'card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Kannaadi transliteration');

    const text = make('div', 'roman', roman);
    text.title = snap.text;

    const actions = make('div', 'actions');
    actions.append(copyButton(roman), actionButton('Replace', 'Replace the Tamil on the page', () => replace(snap)));
    const speak = speakButton(snap);
    if (speak) actions.append(speak);
    actions.append(make('span', 'spacer'), actionButton('✕', 'Close', hideView));

    card.append(text, actions);
    shadow.appendChild(card);
    viewEl = card;
    place(card, snap.anchor, 8);
  }

  function lensRect(range) {
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    if (!rects.length) {
      const b = range.getBoundingClientRect();
      return b.width > 0 || b.height > 0 ? b : null;
    }
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const r of rects) {
      left = Math.min(left, r.left);
      top = Math.min(top, r.top);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    }
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  // The part of the page the user can actually see: the viewport narrowed by every scroll / overflow box
  // around the selection. Text scrolled out of a box must not drag the lens outside that box.
  function visibleClip(range) {
    let clip = { left: 0, top: 0, right: document.documentElement.clientWidth, bottom: document.documentElement.clientHeight };
    const node = range.commonAncestorContainer;
    let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const rootOverflow = getComputedStyle(document.documentElement);
    const bodyIsViewport = rootOverflow.overflowX === 'visible' && rootOverflow.overflowY === 'visible';
    for (; el && el !== document.documentElement; el = el.parentElement) {
      // <body>'s overflow is handed to the viewport (YouTube: scroll, with a 0px client height), so it is no box
      if (el === document.body && bodyIsViewport) continue;
      const cs = getComputedStyle(el);
      if (!/auto|scroll|hidden|clip/.test(cs.overflowX + ' ' + cs.overflowY)) continue;
      // inline / display:contents boxes report a 0x0 client area and do not clip anything themselves
      if (cs.display === 'inline' || cs.display === 'contents') continue;
      const r = el.getBoundingClientRect();
      const left = r.left + el.clientLeft;
      const top = r.top + el.clientTop;
      clip = {
        left: Math.max(clip.left, left),
        top: Math.max(clip.top, top),
        right: Math.min(clip.right, left + el.clientWidth),
        bottom: Math.min(clip.bottom, top + el.clientHeight),
      };
    }
    return clip;
  }

  function layoutLens() {
    if (!lensState) return false;
    const { wrap, body, bar, snap } = lensState;
    const full = lensRect(snap.range);
    if (!full) return false;

    const clip = visibleClip(snap.range);
    const left = Math.max(full.left, clip.left);
    const top = Math.max(full.top, clip.top);
    const right = Math.min(full.right, clip.right);
    const bottom = Math.min(full.bottom, clip.bottom);
    if (right <= left || bottom <= top) {      // selection is scrolled completely out of view
      wrap.style.visibility = 'hidden';
      return false;
    }
    wrap.style.visibility = '';

    const rect = { left, top, bottom, width: right - left, height: bottom - top };
    const truncated = full.height > rect.height + 1;   // part of the selection is out of view
    setPos(wrap, rect.left - PAD_X, rect.top - PAD_Y);
    const w = Math.round(rect.width + PAD_X * 2);
    body.style.minWidth = w + 'px';
    body.style.maxWidth = Math.max(w, 320) + 'px';
    body.style.minHeight = Math.round(rect.height + PAD_Y * 2) + 'px';
    // a clipped lens keeps the visible area's size and scrolls inside, instead of spilling over the page
    body.style.maxHeight = truncated ? Math.round(rect.height + PAD_Y * 2) + 'px' : '';
    body.classList.toggle('clipped', truncated);

    const vh = document.documentElement.clientHeight;
    wrap.classList.toggle('bar-top', rect.bottom + PAD_Y + bar.offsetHeight + 12 > vh);

    // is the lens actually on screen? (reported to showLens, which falls back to the card when it is not)
    const b = body.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    return b.width > 0 && b.height > 0 && b.right > 0 && b.bottom > 0 && b.left < vw && b.top < vh;
  }

  async function showLens(snap) {
    ensureHost();
    await ready;
    hideIcon();
    hideView();
    hidePill();
    hideChip();

    const probe = lensRect(snap.range);
    if (!probe) { showCard(snap); return; }

    const roman = transliterate(snap.text, settings.scheme);
    const wrap = make('div', 'lens-wrap');
    const body = make('div', 'lens');
    body.setAttribute('role', 'dialog');
    body.setAttribute('aria-label', 'Kannaadi transliteration');
    body.title = snap.text;
    body.append(make('div', 'lens-text', roman.replace(/\n{2,}/g, '\n')));

    // match the page's text size so the English letters sit where the Tamil was
    const host0 = snap.range.startContainer.nodeType === Node.TEXT_NODE
      ? snap.range.startContainer.parentElement : snap.range.startContainer;
    if (host0) {
      const cs = getComputedStyle(host0);
      const fs = Math.min(26, Math.max(13, parseFloat(cs.fontSize) || 16));
      const lh = parseFloat(cs.lineHeight);
      body.style.setProperty('--k-fs', fs + 'px');
      // follow the page's line height, but not the airy 1.7+ some pages use
      const line = Number.isFinite(lh) ? Math.min(Math.max(lh, fs * 1.25), fs * 1.6) : fs * 1.45;
      body.style.setProperty('--k-lh', line + 'px');
    }

    const bar = make('div', 'lens-bar');
    bar.append(
      copyButton(roman),
      actionButton('Replace', 'Replace the Tamil on the page', () => replace(snap)),
      actionButton('Card', 'Show as a card instead', () => showCard(snap)),
    );
    const speak = speakButton(snap);
    if (speak) bar.append(speak);
    bar.append(actionButton('✕', 'Close', hideView));

    wrap.append(body, bar);
    shadow.appendChild(wrap);
    viewEl = wrap;
    lensState = { snap, wrap, body, bar };
    if (!layoutLens()) showCard(snap);   // the lens cannot be shown over this text; never leave the user with nothing
  }

  // ---------- replace (wrapped, restorable) ----------

  function textNodesIn(range) {
    const root = range.commonAncestorContainer;
    if (root.nodeType === Node.TEXT_NODE) return [root];
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (range.intersectsNode(n)) nodes.push(n);
    return nodes;
  }

  function replace(snap) {
    hideView();
    if (snap.kind === 'field') { replaceField(snap); return; }

    const range = snap.range;
    const parts = [];
    for (const node of textNodesIn(range)) {
      const start = node === range.startContainer ? range.startOffset : 0;
      const end = node === range.endContainer ? range.endOffset : node.length;
      if (end > start && hasTamil(node.data.slice(start, end))) parts.push({ node, start, end });
    }
    if (!parts.length) return;

    const parent = parts[0].node.parentElement;
    if (parent && parent.isContentEditable) { replaceEditable(parts, snap); return; }

    const wrappers = [];
    for (const part of parts) wrapPart(part, wrappers);
    try { window.getSelection().removeAllRanges(); } catch (_) { /* ignore */ }
    // sit the pill at the end of the replaced text (it is shorter now, so the old anchor may be over other text)
    let anchor = snap.anchor;
    const lastWrapper = wrappers[wrappers.length - 1];
    if (lastWrapper) {
      const r = lastWrapper.getBoundingClientRect();
      if (r.width || r.height) anchor = { x: r.right, y: r.bottom, top: r.top };
    }
    showPill(() => wrappers.forEach(unwrap), anchor);
  }

  // <kannaadi-w data-ta="வணக்கம்">vanakkam</kannaadi-w>: the Tamil stays on the element so it can be restored.
  function wrapPart({ node, start, end }, wrappers) {
    let target = node;
    if (end < target.length) target.splitText(end);
    if (start > 0) target = target.splitText(start);
    const frag = document.createDocumentFragment();
    for (const run of splitTamil(target.data)) {
      if (run.tamil) {
        const w = document.createElement('kannaadi-w');
        w.dataset.ta = run.text;
        w.textContent = transliterate(run.text, settings.scheme);
        frag.append(w);
        wrappers.push(w);
      } else {
        frag.append(document.createTextNode(run.text));
      }
    }
    target.replaceWith(frag);
  }

  function unwrap(w) {
    if (!w.isConnected) return;
    const parent = w.parentNode;
    w.replaceWith(document.createTextNode(w.dataset.ta || w.textContent));
    parent.normalize();
  }

  function restoreAll() {
    hideChip();
    document.querySelectorAll('kannaadi-w').forEach(unwrap);
  }

  // Inputs and editable areas: no wrapper elements (they would leak into what the user is writing).
  // insertText keeps the browser's own undo stack, so Ctrl+Z works there.
  function typeOver(text) {
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (_) { /* fall back below */ }
    return ok;
  }

  function replaceField(snap) {
    const el = snap.el;
    if (el.value.slice(snap.start, snap.end) !== snap.text) return;
    const original = snap.text;
    const out = transliterate(original, settings.scheme);
    const apply = (from, to, text) => {
      el.focus();
      el.setSelectionRange(from, to);
      if (!typeOver(text)) {
        el.setRangeText(text, from, to, 'end');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
    apply(snap.start, snap.end, out);
    showPill(() => apply(snap.start, snap.start + out.length, original), snap.anchor);
  }

  function replaceEditable(parts, snap) {
    const sel = window.getSelection();
    const editHost = parts[0].node.parentElement.closest('[contenteditable]:not([contenteditable="false"])');
    if (editHost) editHost.focus();

    const apply = (node, start, end, text) => {
      const r = document.createRange();
      r.setStart(node, start);
      r.setEnd(node, end);
      sel.removeAllRanges();
      sel.addRange(r);
      if (!typeOver(text)) node.replaceData(start, end - start, text);
    };

    const done = [];
    for (const p of parts.slice().reverse()) {
      const original = p.node.data.slice(p.start, p.end);
      const out = transliterate(original, settings.scheme);
      apply(p.node, p.start, p.end, out);
      done.push({ node: p.node, start: p.start, original, out });
    }
    showPill(() => {
      for (const d of done.slice().reverse()) {
        if (d.node.isConnected && d.node.data.slice(d.start, d.start + d.out.length) === d.out) {
          apply(d.node, d.start, d.start + d.out.length, d.original);
        }
      }
    }, snap.anchor);
  }

  // ---------- "Replaced / Undo" pill ----------

  async function showPill(undo, anchor) {
    ensureHost();
    await ready;
    hidePill();
    pillEl = make('div', 'pill');
    pillEl.append(
      make('span', null, 'Replaced'),
      actionButton('Undo', 'Put the Tamil text back', () => { undo(); hidePill(); }),
    );
    shadow.appendChild(pillEl);
    place(pillEl, anchor, 8);
    pillTimer = setTimeout(hidePill, 6000);
  }

  function hidePill() {
    clearTimeout(pillTimer);
    if (pillEl) { pillEl.remove(); pillEl = null; }
  }

  // ---------- hover chip: restore one word, or all ----------

  async function showChip(word) {
    ensureHost();
    await ready;
    if (!word.isConnected) return;
    hideChip();
    chipWord = word;
    chipEl = make('div', 'chip');
    chipEl.append(
      make('span', 'chip-ta', word.dataset.ta || ''),
      actionButton('↺ Restore', 'Put this word back', () => { unwrap(word); hideChip(); }),
      actionButton('Restore all', 'Put all Tamil on this page back', restoreAll),
    );
    shadow.appendChild(chipEl);
    placeAbove(chipEl, word.getBoundingClientRect());
  }

  function hideChip() {
    clearTimeout(chipShowTimer);
    clearTimeout(chipHideTimer);
    chipWord = null;
    if (chipEl) { chipEl.remove(); chipEl = null; }
  }

  document.addEventListener('mouseover', (e) => {
    if (insideHost(e)) { clearTimeout(chipHideTimer); return; }
    const word = e.target && e.target.closest ? e.target.closest('kannaadi-w') : null;
    if (word) {
      clearTimeout(chipHideTimer);
      if (word !== chipWord) {
        clearTimeout(chipShowTimer);
        chipShowTimer = setTimeout(() => showChip(word), 200);
      }
    } else {
      clearTimeout(chipShowTimer);
      if (chipEl) chipHideTimer = setTimeout(hideChip, 350);
    }
  }, true);

  // ---------- wiring ----------

  function insideHost(e) {
    return !!host && e.composedPath().includes(host);
  }

  document.addEventListener('mousedown', (e) => {
    if (insideHost(e)) return;
    mouseDown = true;
    hideView();
    hideIcon();
    hideChip();
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
    if (e.key === 'Escape') { hideView(); hideIcon(); hideChip(); return; }
    // Fallback for when Chrome did not assign the extension shortcut.
    if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyT') {
      const snap = snapshot();
      if (snap && hasTamil(snap.text)) {
        e.preventDefault();
        current = snap;
        openView(snap);
      }
    }
  }, true);

  // Keep the lens glued to the text when the page or an inner scroll box moves.
  function relayout() {
    if (layoutFrame || !(lensState || chipEl)) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      layoutLens();
      if (chipEl && chipWord && chipWord.isConnected) placeAbove(chipEl, chipWord.getBoundingClientRect());
    });
  }
  window.addEventListener('scroll', relayout, { capture: true, passive: true });
  window.addEventListener('resize', relayout);

  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (!msg) return;
      if (msg.type === 'kannaadi:open') {
        const snap = snapshot();
        if (snap && hasTamil(snap.text)) { current = snap; openView(snap); }
      } else if (msg.type === 'kannaadi:restoreAll') {
        restoreAll();
      }
    });
  } catch (_) { /* extension was reloaded */ }
})();
