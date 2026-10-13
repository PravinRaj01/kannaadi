# Kannaadi (கண்ணாடி)

Select Tamil text on any web page and read it in English letters, laid right over the text like a pane of glass. *Kannaadi* means "glass" or "mirror" in Tamil: Tamil script on one side, its reflection in Latin letters on the other.

| Tamil | Tanglish | ISO 15919 |
| --- | --- | --- |
| வணக்கம் | vanakkam | vaṇakkam |
| நன்றி | nandri | naṉṟi |
| சாப்பாடு | saappaadu | cāppāṭu |
| தமிழ் | thamizh | tamiḻ |

## Features

- **Glass icon** appears at the end of any Tamil selection. Click it, or press **Alt+Shift+T**.
- **Lens view (default)**: a liquid-glass pane covers the selected text and shows the English letters on top of it, sized to match the page. A small toolbar sits under it: Copy, Replace, Card, 🔊, ✕. It follows the text when the page or an inner scroll box moves.
- **Card view**: the same result in a small floating card beside the selection. Switch in the popup.
- **Replace in page**: swaps Tamil for English letters. Each replaced word remembers its Tamil:
  - hover a replaced word → a chip offers **Restore** (just that word) or **Restore all**;
  - the popup has **Restore all Tamil on this page**;
  - a 6-second **Undo** pill restores the whole batch;
  - inside inputs, textareas and editable areas it types the replacement, so **Ctrl+Z** works.
- **Right-click menu**: "Transliterate with Kannaadi".
- **Two styles**: Tanglish (how people actually type Tamil) and ISO 15919 (academic).
- Light and dark glass, follows your system theme. Rendered in a Shadow DOM so page CSS cannot break it.
- No network calls, no tracking. The engine is a small rule-based function that runs locally.

## Where it works

| Where | Works? |
| --- | --- |
| Normal web pages, blogs, news, Wikipedia | Full lens, card, replace, restore |
| Web readers built on PDF.js (text-layer PDFs) | Lens and card. Replace is not useful there: the visible page is an image and the text layer is invisible |
| Web EPUB readers (epub.js-style, chapters in iframes) | Full, the content script also runs in `blob:` / `srcdoc` frames |
| Chrome's built-in PDF viewer | Not inside the viewer (extensions cannot run there). Select, right-click → **Transliterate with Kannaadi** → result opens in the **side panel** |
| Canvas-rendered text (Kindle Cloud Reader, Google Docs) | No: there is no real text to select |
| Chrome Web Store, `chrome://` pages | No: Chrome blocks extensions there |

Chrome cannot open `.epub` files by itself; use a web EPUB reader.

## Install (developer mode)

1. Clone this repo.
2. Open `chrome://extensions` and switch on **Developer mode**.
3. Click **Load unpacked** and pick the repo folder.
4. Open [demo/index.html](demo/index.html) (for `file://` pages, turn on **Allow access to file URLs** in the extension's details), or any Tamil page such as ta.wikipedia.org.

If Alt+Shift+T is already taken, Chrome leaves the shortcut unset. Kannaadi still answers Alt+Shift+T on web pages; for PDFs set a shortcut at `chrome://extensions/shortcuts`.

## How the Tanglish engine works

Tamil has one letter for sounds that English splits in two, so `க` is *k* at the start of a word and *g* between vowels. The engine in [src/engine/transliterate.js](src/engine/transliterate.js) tokenizes the text into consonant + vowel units and spells each stop by its neighbours:

| Context | Rule | Example |
| --- | --- | --- |
| word start | க k · ச s · ட t · த th · ப p | கடல் kadal |
| between vowels | க g · ட d · த dh · ப b (ச stays s) | பகல் pagal |
| after a nasal | க g · ச j · ட d · த dh · ப b | தங்கம் thangam, மஞ்சள் manjal |
| doubled | stays unvoiced | வணக்கம் vanakkam, பத்து paththu |
| ன்ற / ற்ற | dr / tr | நன்றி nandri, காற்று kaatru |

Anything that is not Tamil passes through untouched, so mixed English + Tamil text works.

## Develop

```bash
npm test         # engine unit tests (Node, no dependencies)
npm run icons    # regenerate icons/ (Windows, System.Drawing)
```

```
manifest.json
src/engine/transliterate.js   pure Tamil -> Latin engine (shared by content script, popup, side panel)
src/content/content.js        selection, icon, lens/card, replace + restore
src/content/ui.css            glass styles (loaded into the shadow root)
src/content/page.css          styling for replaced words (dotted underline)
src/background.js             shortcut, context menu, PDF -> side panel routing
src/popup/                    settings, "try it" box, restore all
src/panel/                    side panel for PDFs
demo/index.html               sample Tamil to test with
test/engine.test.js
```

## Ideas for later

- Tanglish → Tamil (the reverse direction)
- Per-site on/off list
- User dictionary for names and loanwords (டாக்டர், பஸ்)
- Firefox build

## License

MIT
