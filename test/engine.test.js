'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { transliterate, hasTamil, splitTamil } = require('../src/engine/transliterate.js');

const tanglish = [
  ['வணக்கம்', 'vanakkam'],
  ['நன்றி', 'nandri'],
  ['சாப்பாடு', 'saappaadu'],
  ['தமிழ்', 'thamizh'],
  ['தமிழ்நாடு', 'thamizhnaadu'],
  ['பகல்', 'pagal'],
  ['அம்மா', 'ammaa'],
  ['காற்று', 'kaatru'],
  ['மஞ்சள்', 'manjal'],
  ['கண்டு', 'kandu'],
  ['ஜன்னல்', 'jannal'],
  ['பத்து', 'paththu'],
  ['தங்கம்', 'thangam'],
  ['அந்த', 'andha'],
  ['தம்பி', 'thambi'],
  ['வாழ்க்கை', 'vaazhkkai'],
  ['பச்சை', 'pacchai'],
  ['நன்றாக', 'nandraaga'],
  ['என்று', 'endru'],
  ['பேசு', 'paesu'],
  ['ஸ்ரீ', 'sree'],
  ['க்ஷ', 'ksha'],
];

for (const [tamil, roman] of tanglish) {
  test('tanglish: ' + tamil + ' -> ' + roman, () => assert.equal(transliterate(tamil, 'tanglish'), roman));
}

const iso = [
  ['வணக்கம்', 'vaṇakkam'],
  ['நன்றி', 'naṉṟi'],
  ['தமிழ்', 'tamiḻ'],
  ['ஆசிரியர்', 'āciriyar'],
];
for (const [tamil, roman] of iso) {
  test('iso: ' + tamil + ' -> ' + roman, () => assert.equal(transliterate(tamil, 'iso'), roman));
}

test('non-Tamil text passes through untouched', () => {
  assert.equal(transliterate('Hello வணக்கம்!', 'tanglish'), 'Hello vanakkam!');
  assert.equal(transliterate('2026-10-13 abc', 'tanglish'), '2026-10-13 abc');
});

test('Tamil digits become ASCII digits', () => assert.equal(transliterate('௧௨௩', 'tanglish'), '123'));
test('decomposed vowel signs are normalised', () => assert.equal(transliterate('கொ', 'tanglish'), 'ko'));
test('empty input', () => assert.equal(transliterate('', 'tanglish'), ''));
test('hasTamil', () => {
  assert.equal(hasTamil('abc வணக்கம்'), true);
  assert.equal(hasTamil('hello'), false);
});

test('splitTamil separates Tamil words from everything else', () => {
  assert.deepEqual(splitTamil('Hi வணக்கம், நன்றி!'), [
    { tamil: false, text: 'Hi ' },
    { tamil: true, text: 'வணக்கம்' },
    { tamil: false, text: ', ' },
    { tamil: true, text: 'நன்றி' },
    { tamil: false, text: '!' },
  ]);
  assert.deepEqual(splitTamil(''), []);
  assert.deepEqual(splitTamil('abc'), [{ tamil: false, text: 'abc' }]);
});

test('word-by-word output equals whole-text output (per-word restore relies on this)', () => {
  const samples = [
    'வணக்கம்! என் பெயர் கண்ணாடி. நன்றி, மீண்டும் சந்திப்போம்.',
    'தமிழ் மொழி உலகின் மிகப் பழமையான மொழிகளில் ஒன்று.',
    'Today I learned: தங்கம் means gold, and காற்று means wind.',
  ];
  for (const scheme of ['tanglish', 'iso']) {
    for (const s of samples) {
      const perRun = splitTamil(s).map((r) => (r.tamil ? transliterate(r.text, scheme) : r.text)).join('');
      assert.equal(perRun, transliterate(s, scheme));
    }
  }
});
