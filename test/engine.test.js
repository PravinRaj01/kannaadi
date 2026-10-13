'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { transliterate, hasTamil, splitTamil, STYLES, OPTIONS } = require('../src/engine/transliterate.js');

const tanglish = [
  ['வணக்கம்', 'vanakkam'],
  ['நன்றி', 'nandri'],
  ['சாப்பாடு', 'saappaadu'],
  ['தமிழ்', 'thamizh'],
  ['தமிழ்நாடு', 'thamizhnaadu'],
  ['பகல்', 'pagal'],
  ['அம்மா', 'ammaa'],
  ['காற்று', 'kaattru'],
  ['மஞ்சள்', 'manjal'],
  ['கண்டு', 'kandu'],
  ['ஜன்னல்', 'jannal'],
  ['பத்து', 'paththu'],
  ['பத்தி', 'paththi'],
  ['தங்கம்', 'thangam'],
  ['அந்த', 'antha'],
  ['தம்பி', 'thambi'],
  ['வாழ்க்கை', 'vaazhkkai'],
  ['பச்சை', 'pachchai'],
  ['நன்றாக', 'nandraaga'],
  ['என்று', 'endru'],
  ['பேசு', 'paesu'],
  ['ஸ்ரீ', 'sree'],
  ['க்ஷ', 'ksha'],
  ['ஞானம்', 'gnaanam'],
  ['அஃது', 'ahthu'],
];

for (const [tamil, roman] of tanglish) {
  test('tanglish: ' + tamil + ' -> ' + roman, () => assert.equal(transliterate(tamil, 'tanglish'), roman));
}

const casual = [
  ['அம்மா', 'amma'],
  ['காற்று', 'kaatru'],
  ['பச்சை', 'pachai'],
  ['பத்தி', 'paththi'],
  ['வணக்கம்', 'vanakkam'],
];
for (const [tamil, roman] of casual) {
  test('casual: ' + tamil + ' -> ' + roman, () => assert.equal(transliterate(tamil, 'casual'), roman));
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

test('tanglish keeps soft and hard doubled stops apart (பத்தி vs பட்டி)', () => {
  assert.notEqual(transliterate('பத்தி', 'tanglish'), transliterate('பட்டி', 'tanglish'));
  assert.equal(transliterate('பட்டி', 'tanglish'), 'patti');
});

test('tanglish keeps short and long vowels apart', () => {
  assert.notEqual(transliterate('கல', 'tanglish'), transliterate('காலா', 'tanglish'));
  assert.notEqual(transliterate('இல்', 'tanglish'), transliterate('ஈல்', 'tanglish'));
});

test('every style value stays inside the allowed options', () => {
  for (const [key, o] of Object.entries(OPTIONS)) {
    assert.ok(o.tang.includes(STYLES.tanglish[key]), 'tanglish ' + key + '=' + STYLES.tanglish[key]);
    assert.ok(o.all.includes(STYLES.casual[key]), 'casual ' + key + '=' + STYLES.casual[key]);
  }
});

test('unknown scheme falls back to tanglish', () => assert.equal(transliterate('நன்றி', 'nope'), 'nandri'));

test('loanwords: English words keep their English spelling in informal styles only', () => {
  assert.equal(transliterate('ஜூலை', 'tanglish'), 'july');
  assert.equal(transliterate('ஜூலை', 'casual'), 'july');
  assert.notEqual(transliterate('ஜூலை', 'iso'), 'july');
  assert.equal(transliterate('இன்று ஜூலை மாதம்', 'tanglish'), 'indru july maadham'.replace('maadham', transliterate('மாதம்', 'tanglish')));
});

test('loanwords: only whole words match', () => {
  assert.notEqual(transliterate('ஜூலையில்', 'tanglish'), 'julyil');
});

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
    'Today I learned: தங்கம் means gold, and காற்று means wind, in ஜூலை.',
  ];
  for (const scheme of ['tanglish', 'casual', 'iso']) {
    for (const s of samples) {
      const perRun = splitTamil(s).map((r) => (r.tamil ? transliterate(r.text, scheme) : r.text)).join('');
      assert.equal(perRun, transliterate(s, scheme));
    }
  }
});
