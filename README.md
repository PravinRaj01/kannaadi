# Kannaadi (கண்ணாடி)

Select Tamil text on any web page and read it in English letters, laid right over the text like a pane of glass. *Kannaadi* means "glass" or "mirror" in Tamil: Tamil script on one side, its reflection in Latin letters on the other.

| Tamil | Tanglish | Casual | ISO 15919 |
| --- | --- | --- | --- |
| வணக்கம் | vanakkam | vanakkam | vaṇakkam |
| நன்றி | nandri | nandri | naṉṟi |
| அம்மா | ammaa | amma | ammā |
| பச்சை | pachchai | pachai | paccai |
| பத்தி / பட்டி | paththi / patti | paththi / patti | patti / paṭṭi |

## Features

- **Glass icon** appears at the end of any Tamil selection. Click it, or press **Alt+Shift+T**.
- **Lens view (default)**: a liquid-glass pane covers the selected text and shows the English letters on top of it, sized to match the page. A small toolbar sits under it: Copy, Replace, Card, 🔊, ✕. It follows the text when the page or an inner scroll box moves, and stays inside scroll boxes.
- **Card view**: the same result in a small floating card beside the selection. Switch in the popup.
- **Replace in page**: swaps Tamil for English letters. Each replaced word remembers its Tamil:
  - hover a replaced word → a chip offers **Restore** (just that word) or **Restore all**;
  - the popup has **Restore Tamil** for the whole page;
  - a 6-second **Undo** pill restores the whole batch;
  - inside inputs, textareas and editable areas it types the replacement, so **Ctrl+Z** works.
- **Right-click menu**: "Transliterate with Kannaadi".
- **Three spelling styles** (pick in the popup): Tanglish, Casual and ISO 15919. English words and names written in Tamil script (ஜூலை, சென்னை, விண்டோஸ்) keep their English spelling in the first two.
- Light and dark glass, follows your system theme. Rendered in a Shadow DOM so page CSS cannot break it.
- No network calls, no tracking. The engine is a small rule-based function that runs locally.

## Spelling styles

| Style | Goal |
| --- | --- |
| **Tanglish** (default) | The way people actually type Tamil, but still readable and exact: long and short vowels stay apart (`aa`/`a`), soft and hard doubled stops stay apart (`paththi` / `patti`). |
| **Casual** | Tanglish with only the lightenings that cost under 1% against real data: final long *aa* (`amma`), `kaatru`, `pachai`. Everything else was a bigger loss, so it is not lightened. |
| **ISO 15919** | Academic transliteration with diacritics. |

### How the spellings were chosen

Tamil has one letter for sounds that English splits in two (`க` is *k* at the start of a word and *g* between vowels). Instead of guessing, the informal styles are tuned against the [Dakshina](https://github.com/google-research-datasets/dakshina) Tamil romanization lexicon: Tamil words with the Latin spellings real people typed for them, with counts.

[scripts/eval.js](scripts/eval.js) measures how often our output equals what people typed, and tunes each spelling choice (about 30 of them, all in `STYLES` in [src/engine/transliterate.js](src/engine/transliterate.js)):

| | before tuning | Tanglish (tuned) | Casual |
| --- | --- | --- | --- |
| attestations that match, train | 35.4% | 41.2% | 39.9% |
| attestations that match, held-out test | | 41.5% | |
| word's most common spelling matches (top-1), test | | 58.4% | |
| any attested spelling matches, test | | 81.1% | |

About 42% might sound low. The lexicon is full of English names and loanwords spelled the English way (it has `stephan` where rules give `steepan`, `mayor` where rules give `maeyar`), and people disagree on almost everything. For example, `பத்தி` was typed `paththi` far more often than `pathi` or `patthi` (every alternative scored about 5 points worse), which is why it stays `paththi`.

Data is only used to measure and tune. It is **not** included in this repo or the extension.

```bash
# get ta/lexicons/ta.translit.sampled.{train,dev,test}.tsv from the Dakshina release (CC BY-SA 4.0), then:
node scripts/eval.js ta.translit.sampled.train.tsv --dev ta.translit.sampled.dev.tsv           # score current rules
node scripts/eval.js ta.translit.sampled.train.tsv --dev ta.translit.sampled.dev.tsv --tune    # re-tune Tanglish
node scripts/eval.js ta.translit.sampled.train.tsv --worst 40                                  # most common misses
```

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

## Develop

```bash
npm test         # engine unit tests (Node, no dependencies)
npm run icons    # regenerate icons/ (Windows, System.Drawing)
```

```
manifest.json
src/engine/transliterate.js   pure Tamil -> Latin engine: rules, STYLES, loanword list (shared by content script, popup, side panel)
src/content/content.js        selection, icon, lens/card, replace + restore
src/content/ui.css            glass styles (loaded into the shadow root)
src/content/page.css          styling for replaced words (dotted underline)
src/background.js             shortcut, context menu, PDF -> side panel routing
src/popup/                    settings (style, view, icon, shortcut), "try it" box, restore
src/panel/                    side panel for PDFs
scripts/eval.js               measure and tune spellings against the Dakshina lexicon
demo/index.html               sample Tamil to test with
test/engine.test.js
```

## Ideas for later

- **Tanglish → Tamil** (typing English letters, getting Tamil). That direction is ambiguous (`pathi` could be பதி, பத்தி or பாதி), so it needs a model that has seen real text. The plan is an **on-device** character-level model (ONNX via onnxruntime-web or transformers.js, in the style of AI4Bharat's [IndicXlit](https://github.com/AI4Bharat/IndicXlit) trained on [Aksharantar](https://huggingface.co/datasets/ai4bharat/Aksharantar)): fully offline, nothing sent to a server. The same model could also act as a second opinion for words the rules are unsure about.
- Per-site on/off list
- A bigger user-editable loanword list
- Firefox build

## Data sources

- [Dakshina dataset](https://github.com/google-research-datasets/dakshina) (Google, CC BY-SA 4.0): used offline to tune and evaluate spellings, not redistributed.
- Aksharantar / IndicXlit (AI4Bharat, CC-BY / CC0): considered for the future reverse-direction model.

## License

MIT
