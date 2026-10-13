# Kannaadi (கண்ணாடி)

Select Tamil text on any web page and read it in English letters. *Kannaadi* means "glass" or "mirror" in Tamil, which is the idea: Tamil script on one side, its reflection in Latin letters on the other, shown in a frosted-glass card.

| Tamil | Tanglish | ISO 15919 |
| --- | --- | --- |
| வணக்கம் | vanakkam | vaṇakkam |
| நன்றி | nandri | naṉṟi |
| சாப்பாடு | saappaadu | cāppāṭu |
| தமிழ் | thamizh | tamiḻ |

## Features

- **Glass icon** appears at the end of any Tamil selection. Click it, or press **Alt+Shift+T**.
- **Glass card** shows the Tamil and its English letters, with **Copy**, **Replace** and 🔊 (when your system has a Tamil voice).
- **Replace in page** swaps the selected Tamil for English letters, including inside inputs, textareas and contenteditable areas, with a 6-second **Undo**.
- **Right-click menu**: "Transliterate with Kannaadi".
- **Two styles**: Tanglish (how people actually type Tamil) and ISO 15919 (academic).
- Light and dark glass, follows your system theme. Rendered in a Shadow DOM so page CSS cannot break it.
- No network calls, no tracking. The engine is a small rule-based function that runs locally.

## Install (developer mode)

1. Clone this repo.
2. Open `chrome://extensions` and switch on **Developer mode**.
3. Click **Load unpacked** and pick the repo folder.
4. Open [demo/index.html](demo/index.html) (for `file://` pages, turn on **Allow access to file URLs** in the extension's details), or any Tamil page such as ta.wikipedia.org.

Change the shortcut at `chrome://extensions/shortcuts`.

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
src/engine/transliterate.js   pure Tamil -> Latin engine (also used by the popup)
src/content/content.js        selection, icon, card, replace/undo
src/content/ui.css            glass styles (loaded into the shadow root)
src/background.js             shortcut + context menu
src/popup/                    settings and a "try it" box
demo/index.html               sample Tamil to test with
test/engine.test.js
```

## Ideas for later

- Tanglish → Tamil (the reverse direction)
- Per-site on/off list
- Word-by-word hover mode
- User dictionary for names and loanwords (டாக்டர், பஸ்)
- Firefox build

## License

MIT
