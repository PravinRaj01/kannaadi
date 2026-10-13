'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { transliterate, hasTamil } = require('../src/engine/transliterate.js');

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
