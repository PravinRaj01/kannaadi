/*
 * Kannaadi transliteration engine: Tamil script -> Latin letters.
 *
 *   transliterate(text, 'tanglish')  vanakkam, nandri, saappaadu  (how people actually type Tamil)
 *   transliterate(text, 'iso')       ISO 15919, academic (vanakkam with dots under n)
 *
 * Pure functions, no DOM. Works as a content script (globalThis.Kannaadi) and in Node (module.exports).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Kannaadi = Object.assign(root.Kannaadi || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VIRAMA = '்';

  // char -> [tanglish, iso]
  const V_IND = new Map(Object.entries({
    'அ': ['a', 'a'], 'ஆ': ['aa', 'ā'], 'இ': ['i', 'i'], 'ஈ': ['ee', 'ī'],
    'உ': ['u', 'u'], 'ஊ': ['oo', 'ū'], 'எ': ['e', 'e'], 'ஏ': ['ae', 'ē'],
    'ஐ': ['ai', 'ai'], 'ஒ': ['o', 'o'], 'ஓ': ['o', 'ō'], 'ஔ': ['au', 'au'],
  }));

  const V_SIGN = new Map(Object.entries({
    'ா': ['aa', 'ā'], 'ி': ['i', 'i'], 'ீ': ['ee', 'ī'], 'ு': ['u', 'u'],
    'ூ': ['oo', 'ū'], 'ெ': ['e', 'e'], 'ே': ['ae', 'ē'], 'ை': ['ai', 'ai'],
    'ொ': ['o', 'o'], 'ோ': ['o', 'ō'], 'ௌ': ['au', 'au'],
  }));

  // Consonants: char -> [tanglish, iso]. Stops and a few others are resolved in context by tanglishConsonant().
  const CONS = new Map(Object.entries({
    'க': ['k', 'k'], 'ங': ['ng', 'ṅ'], 'ச': ['s', 'c'], 'ஞ': ['nj', 'ñ'],
    'ட': ['t', 'ṭ'], 'ண': ['n', 'ṇ'], 'த': ['th', 't'], 'ந': ['n', 'n'],
    'ப': ['p', 'p'], 'ம': ['m', 'm'], 'ய': ['y', 'y'], 'ர': ['r', 'r'],
    'ல': ['l', 'l'], 'வ': ['v', 'v'], 'ழ': ['zh', 'ḻ'], 'ள': ['l', 'ḷ'],
    'ற': ['r', 'ṟ'], 'ன': ['n', 'ṉ'],
    // grantha
    'ஜ': ['j', 'j'], 'ஷ': ['sh', 'ṣ'], 'ஸ': ['s', 's'], 'ஹ': ['h', 'h'], 'ஶ': ['sh', 'ś'],
    // aytham and anusvara behave like a bare consonant
    'ஃ': ['h', 'ḵ'], 'ஂ': ['m', 'ṁ'],
  }));

  const DIGITS = new Map(Array.from('௦௧௨௩௪௫௬௭௮௯').map((d, i) => [d, String(i)]));
  const NASALS = new Set(['ங', 'ஞ', 'ண', 'ந', 'ம', 'ன']);

  const hasTamil = (text) => /[஀-௿]/.test(text);

  // Tokens: {t:'v', ch} independent vowel | {t:'c', ch, pure, sign} consonant | {t:'o', ch} anything else
  function tokenize(text) {
    const chars = Array.from(text.normalize('NFC'));
    const out = [];
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (V_IND.has(ch)) {
        out.push({ t: 'v', ch });
      } else if (CONS.has(ch)) {
        const next = chars[i + 1];
        if (next === VIRAMA) { out.push({ t: 'c', ch, pure: true, sign: null }); i++; }
        else if (V_SIGN.has(next)) { out.push({ t: 'c', ch, pure: false, sign: next }); i++; }
        else out.push({ t: 'c', ch, pure: false, sign: null });
      } else {
        out.push({ t: 'o', ch });
      }
    }
    return out;
  }

  // Tanglish spelling of one consonant, using the previous / next letter of the same word.
  function tanglishConsonant(tok, prev, next) {
    const c = tok.ch;
    const prevPure = !!prev && prev.t === 'c' && prev.pure;
    const afterVowel = !!prev && !prevPure;                   // previous syllable ended in a vowel
    const afterNasal = prevPure && NASALS.has(prev.ch);
    const geminate = prevPure && prev.ch === c;               // second half of a doubled consonant
    const voiced = !geminate && (afterVowel || afterNasal);   // stops soften between vowels / after nasals

    switch (c) {
      case 'க': return tok.pure || !voiced ? 'k' : 'g';
      case 'ச':
        if (tok.pure) return next && next.ch === 'ச' ? 'c' : 'ch';
        if (geminate) return 'ch';
        if (prevPure && prev.ch === 'ஞ') return 'j';
        return 's';
      case 'ட': return tok.pure || !voiced ? 't' : 'd';
      case 'த': return tok.pure || !voiced ? 'th' : 'dh';
      case 'ப': return tok.pure || !voiced ? 'p' : 'b';
      case 'ற':
        if (tok.pure) return next && next.ch === 'ற' ? 't' : 'r';
        if (prevPure && prev.ch === 'ன') return 'dr';
        return 'r';
      case 'ங': return tok.pure && next && next.ch === 'க' ? 'n' : 'ng';
      case 'ஞ': return tok.pure ? 'n' : 'nj';
      default: return CONS.get(c)[0];
    }
  }

  function transliterate(text, scheme) {
    if (!text) return '';
    const iso = scheme === 'iso';
    const col = iso ? 1 : 0;
    const toks = tokenize(String(text));
    let out = '';

    for (let i = 0; i < toks.length; i++) {
      const tok = toks[i];
      if (tok.t === 'o') { out += DIGITS.get(tok.ch) ?? tok.ch; continue; }
      if (tok.t === 'v') { out += V_IND.get(tok.ch)[col]; continue; }

      let vowel = '';
      if (!tok.pure) vowel = tok.sign ? V_SIGN.get(tok.sign)[col] : 'a';

      if (iso) { out += CONS.get(tok.ch)[1] + vowel; continue; }

      const prev = toks[i - 1] && toks[i - 1].t !== 'o' ? toks[i - 1] : null;
      const next = toks[i + 1] && toks[i + 1].t === 'c' ? toks[i + 1] : null;
      out += tanglishConsonant(tok, prev, next) + vowel;
    }
    return out;
  }

  return { transliterate, hasTamil };
});
