/*
 * Kannaadi transliteration engine: Tamil script -> Latin letters.
 *
 *   transliterate(text, 'tanglish')  how people type Tamil, readable and keeps distinctions
 *   transliterate(text, 'casual')    lightest spellings people actually text
 *   transliterate(text, 'iso')       ISO 15919, academic
 *
 * Pure functions, no DOM. Works as a content script (globalThis.Kannaadi) and in Node (module.exports).
 * Every spelling choice of the two informal styles lives in STYLES (tuned with scripts/eval.js).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Kannaadi = Object.assign(root.Kannaadi || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VIRAMA = '்';

  // Entries are [tanglish, iso]. A tanglish value starting with '@' is a style key (see STYLES).
  const V_IND = new Map(Object.entries({
    'அ': ['a', 'a'], 'ஆ': ['@aa', 'ā'], 'இ': ['i', 'i'], 'ஈ': ['@ee', 'ī'],
    'உ': ['u', 'u'], 'ஊ': ['@oo', 'ū'], 'எ': ['e', 'e'], 'ஏ': ['@ae', 'ē'],
    'ஐ': ['ai', 'ai'], 'ஒ': ['o', 'o'], 'ஓ': ['o', 'ō'], 'ஔ': ['@au', 'au'],
  }));

  const V_SIGN = new Map(Object.entries({
    'ா': ['@aa', 'ā'], 'ி': ['i', 'i'], 'ீ': ['@ee', 'ī'], 'ு': ['u', 'u'],
    'ூ': ['@oo', 'ū'], 'ெ': ['e', 'e'], 'ே': ['@ae', 'ē'], 'ை': ['ai', 'ai'],
    'ொ': ['o', 'o'], 'ோ': ['o', 'ō'], 'ௌ': ['@au', 'au'],
  }));

  // Consonants: char -> ISO letter. Their informal spellings are resolved in context by informalConsonant().
  const ISO = new Map(Object.entries({
    'க': 'k', 'ங': 'ṅ', 'ச': 'c', 'ஞ': 'ñ', 'ட': 'ṭ', 'ண': 'ṇ', 'த': 't', 'ந': 'n',
    'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r', 'ல': 'l', 'வ': 'v', 'ழ': 'ḻ', 'ள': 'ḷ',
    'ற': 'ṟ', 'ன': 'ṉ',
    'ஜ': 'j', 'ஷ': 'ṣ', 'ஸ': 's', 'ஹ': 'h', 'ஶ': 'ś',
    'ஃ': 'ḵ', 'ஂ': 'ṁ',
  }));

  const DIGITS = new Map(Array.from('௦௧௨௩௪௫௬௭௮௯').map((d, i) => [d, String(i)]));
  const NASALS = new Set(['ங', 'ஞ', 'ண', 'ந', 'ம', 'ன']);
  const SONORANTS = new Set(['ண', 'ந', 'ம', 'ன', 'ய', 'ர', 'ல', 'வ', 'ழ', 'ள']);

  // Stop consonants and their style-key prefixes.
  const STOP_PREFIX = { 'க': 'k', 'ச': 's', 'ட': 't', 'த': 'th', 'ப': 'p' };

  /*
   * Style keys. Where a stop sits decides its spelling:
   *   Init = word start / after another consonant   Med = between vowels
   *   Nas  = after a nasal (ங் ஞ் ண் ந் ம் ன்)       Gem = second half of a doubled consonant
   */
  // Tanglish: values tuned with scripts/eval.js against the Dakshina Tamil lexicon (people shown a Tamil word,
  // typing it in Latin letters). Every alternative for the doubled dental (paththi) scored 5 points worse.
  const TANGLISH = {
    aa: 'aa', aaFinal: 'aa', ee: 'ee', oo: 'oo', ae: 'ae', au: 'au',
    zh: 'zh', v: 'v', sh: 'sh', nj: 'gn', fa: 'f',
    kInit: 'k', kMed: 'g', kNas: 'g', kGem: 'kk',
    sInit: 's', sMed: 's', sNas: 'j', sGem: 'chch',
    tInit: 't', tMed: 'd', tNas: 'd', tGem: 'tt',
    thInit: 'th', thMed: 'th', thNas: 'th', thGem: 'thth',
    pInit: 'p', pMed: 'p', pNas: 'b', pGem: 'pp',
    rrGem: 'ttr', rNas: 'dr', gemSon: 'double',
  };

  // Casual: Tanglish with only the lightenings that cost under 1% against the same data
  // (final long aa: amma, kaatru, pachai). Every other lightening cost 1-12%, so they were left out.
  const STYLES = {
    tanglish: TANGLISH,
    casual: Object.assign({}, TANGLISH, { aaFinal: 'a', rrGem: 'tr', sGem: 'ch' }),
  };

  // Candidate values per key for the tuner. `tang` keeps Tanglish readable (it never merges short/long vowels,
  // or dental த with retroflex ட); `all` is the full range used to measure what a lightening would cost.
  const OPTIONS = {
    aa: { all: ['aa', 'a'], tang: ['aa'] },
    aaFinal: { all: ['aa', 'a'], tang: ['aa', 'a'] },
    ee: { all: ['ee', 'i'], tang: ['ee'] },
    oo: { all: ['oo', 'u'], tang: ['oo'] },
    ae: { all: ['ae', 'e'], tang: ['ae'] },
    au: { all: ['au', 'ow'], tang: ['au', 'ow'] },
    zh: { all: ['zh', 'l', 'z'], tang: ['zh', 'z'] },
    v: { all: ['v', 'w'], tang: ['v', 'w'] },
    sh: { all: ['sh', 's'], tang: ['sh'] },
    nj: { all: ['nj', 'gn', 'n'], tang: ['nj', 'gn'] },
    fa: { all: ['f', 'ph', 'p'], tang: ['f', 'ph'] },
    kInit: { all: ['k', 'g'], tang: ['k', 'g'] },
    kMed: { all: ['g', 'k', 'h'], tang: ['g', 'k', 'h'] },
    kNas: { all: ['g', 'k'], tang: ['g', 'k'] },
    kGem: { all: ['kk', 'k', 'ck'], tang: ['kk', 'ck'] },
    sInit: { all: ['s', 'c', 'ch'], tang: ['s', 'ch'] },
    sMed: { all: ['s', 'c', 'ch'], tang: ['s', 'ch'] },
    sNas: { all: ['j', 'ch', 's'], tang: ['j', 'ch'] },
    sGem: { all: ['cch', 'chch', 'ch', 'ss', 's'], tang: ['cch', 'chch', 'ss'] },
    tInit: { all: ['t', 'd'], tang: ['t', 'd'] },
    tMed: { all: ['d', 't'], tang: ['d', 't'] },
    tNas: { all: ['d', 't'], tang: ['d', 't'] },
    tGem: { all: ['tt', 't'], tang: ['tt'] },
    thInit: { all: ['th', 't'], tang: ['th'] },
    thMed: { all: ['dh', 'th', 'd', 't'], tang: ['dh', 'th'] },
    thNas: { all: ['dh', 'th', 'd', 't'], tang: ['dh', 'th'] },
    thGem: { all: ['thth', 'tth', 'th', 't'], tang: ['thth', 'tth'] },
    pInit: { all: ['p', 'b'], tang: ['p', 'b'] },
    pMed: { all: ['b', 'p'], tang: ['b', 'p'] },
    pNas: { all: ['b', 'p'], tang: ['b', 'p'] },
    pGem: { all: ['pp', 'p'], tang: ['pp'] },
    rrGem: { all: ['tr', 'ttr', 'rr', 'r'], tang: ['tr', 'ttr', 'rr'] },
    rNas: { all: ['dr', 'ndr', 'tr', 'r'], tang: ['dr', 'tr'] },
    gemSon: { all: ['double', 'single'], tang: ['double'] },
  };

  const hasTamil = (text) => /[஀-௿]/.test(text);

  // Split text into alternating runs: [{tamil: true, text: 'வணக்கம்'}, {tamil: false, text: ', hi '}, ...]
  function splitTamil(text) {
    const runs = [];
    const re = /[஀-௿]+/g;
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m.index > last) runs.push({ tamil: false, text: text.slice(last, m.index) });
      runs.push({ tamil: true, text: m[0] });
      last = m.index + m[0].length;
    }
    if (last < text.length) runs.push({ tamil: false, text: text.slice(last) });
    return runs;
  }

  // Tokens: {t:'v', ch} independent vowel | {t:'c', ch, pure, sign} consonant | {t:'o', ch} anything else
  function tokenize(text) {
    const chars = Array.from(text.normalize('NFC'));
    const out = [];
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (V_IND.has(ch)) {
        out.push({ t: 'v', ch });
      } else if (ch === 'ஃ' || ch === 'ஂ') {
        out.push({ t: 'c', ch, pure: true, sign: null });   // aytham / anusvara never carry a vowel
      } else if (ISO.has(ch)) {
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

  // Informal spelling of one consonant, using the previous / next letter of the same word.
  // A pure consonant that is the first half of a doubled one prints nothing; the second half prints the pair.
  function informalConsonant(tok, prev, next, s) {
    const c = tok.ch;
    const prevPure = !!prev && prev.t === 'c' && prev.pure;
    const doubledNext = tok.pure && !!next && next.ch === c;
    const pos = !prev ? 'Init'
      : prevPure && prev.ch === c ? 'Gem'
        : !prevPure ? 'Med'
          : NASALS.has(prev.ch) ? 'Nas' : 'Init';

    const prefix = STOP_PREFIX[c];
    if (prefix) {
      if (c === 'ப' && prev && prev.t === 'c' && prev.ch === 'ஃ') return s.fa;       // ஃப -> f
      if (tok.pure) {
        if (doubledNext) return '';
        return c === 'ச' ? 'ch' : s[prefix + 'Init'];
      }
      if (c === 'ச' && pos === 'Nas' && prev.ch !== 'ஞ') return s.sMed;
      return s[prefix + pos];
    }

    if (c === 'ற') {
      if (tok.pure) return doubledNext ? '' : 'r';
      if (pos === 'Gem') return s.rrGem;
      return prevPure && prev.ch === 'ன' ? s.rNas : 'r';
    }

    if (SONORANTS.has(c)) {
      if (doubledNext && s.gemSon === 'single') return '';
      if (c === 'ம') return 'm';
      if (c === 'ய') return 'y';
      if (c === 'ர') return 'r';
      if (c === 'வ') return s.v;
      if (c === 'ழ') return s.zh;
      if (c === 'ல' || c === 'ள') return 'l';
      return 'n';                                                                      // ண ந ன
    }

    switch (c) {
      case 'ங': return tok.pure && next && next.ch === 'க' ? 'n' : 'ng';
      case 'ஞ': return tok.pure ? 'n' : s.nj;
      case 'ஜ': return 'j';
      case 'ஷ': return s.sh;
      case 'ஸ': return 's';
      case 'ஹ': return 'h';
      case 'ஶ': return 'sh';
      case 'ஃ': return next && next.ch === 'ப' ? '' : 'h';
      case 'ஂ': return 'm';
      default: return '';
    }
  }

  function resolveStyle(scheme, override) {
    const base = STYLES[scheme] || STYLES.tanglish;
    return override ? Object.assign({}, base, override) : base;
  }

  // English words and names written in Tamil script read better in their original spelling (july, not joolai).
  // Exact whole-word matches only, informal styles only. Hand-written; extend freely.
  const LOANWORDS = new Map(Object.entries({
    // months
    'ஜனவரி': 'january', 'பிப்ரவரி': 'february', 'மார்ச்': 'march', 'ஏப்ரல்': 'april', 'ஜூன்': 'june',
    'ஜூலை': 'july', 'ஆகஸ்ட்': 'august', 'செப்டம்பர்': 'september', 'அக்டோபர்': 'october',
    'நவம்பர்': 'november', 'டிசம்பர்': 'december',
    // places
    'சென்னை': 'chennai', 'கொல்கத்தா': 'kolkata', 'குஜராத்': 'gujarat', 'ஜெய்ப்பூர்': 'jaipur',
    'வாஷிங்டன்': 'washington', 'குவைத்': 'kuwait', 'துருக்கி': 'turkey', 'இந்தோனேஷியா': 'indonesia',
    'ஊட்டி': 'ooty', 'கலிபோர்னியா': 'california', 'கம்போடியா': 'cambodia', 'வெனிசுலா': 'venezuela',
    'புளோரிடா': 'florida', 'மங்கோலியா': 'mongolia', 'அங்கோலா': 'angola', 'விக்டோரியா': 'victoria',
    'கரீபியன்': 'caribbean', 'ஹாலிவுட்': 'hollywood', 'பாலிவுட்': 'bollywood',
    // everyday and tech
    'இஸ்லாம்': 'islam', 'விண்டோஸ்': 'windows', 'ட்விட்டர்': 'twitter', 'யாகூ': 'yahoo',
    'வீடியோ': 'video', 'ஆட்டோ': 'auto', 'லேசர்': 'laser', 'ராயல்': 'royal', 'ஸ்டாக்': 'stock',
    'பாஸ்': 'boss', 'ஈஸ்ட்': 'east', 'வெஸ்டர்ன்': 'western', 'சோவியத்': 'soviet',
    'இம்பீரியல்': 'imperial', 'பிளாட்': 'flat', 'டுடே': 'today', 'கிலோமீட்டர்': 'kilometer',
    'மில்லிமீட்டர்': 'millimeter', 'காமன்வெல்த்': 'commonwealth', 'நெட்வொர்க்கிங்': 'networking',
    'கால்சியம்': 'calcium', 'பொட்டாசியம்': 'potassium', 'பஸ்': 'bus', 'டாக்டர்': 'doctor',
    'போன்': 'phone', 'ஸ்கூல்': 'school', 'காலேஜ்': 'college', 'ஆபீஸ்': 'office', 'டிக்கெட்': 'ticket',
    'கம்ப்யூட்டர்': 'computer', 'இன்டர்நெட்': 'internet', 'மொபைல்': 'mobile', 'டிவி': 'tv',
    // names
    'ஜோசப்': 'joseph', 'ஹென்றி': 'henry', 'மேரி': 'mary', 'ஜேசன்': 'jason', 'ஜாக்சன்': 'jackson',
    'பீட்டர்சன்': 'peterson', 'சோனி': 'sony', 'ஆலிவர்': 'oliver', 'ஆஸ்டின்': 'austin',
    'எலிசபெத்': 'elizabeth', 'கிறிஸ்டோபர்': 'christopher', 'ஜூலியட்': 'juliet', 'வார்னர்': 'warner',
    'மடோனா': 'madonna', 'மார்ஷல்': 'marshal', 'காந்தி': 'gandhi', 'பிரியங்கா': 'priyanka',
  }));

  // `override` (optional) replaces individual style keys; used by the tuning script, which must not see LOANWORDS.
  function transliterate(text, scheme, override) {
    if (!text) return '';
    if (scheme !== 'iso' && !override) {
      const runs = splitTamil(String(text));
      if (runs.some((r) => r.tamil && LOANWORDS.has(r.text))) {
        return runs.map((r) => (r.tamil ? LOANWORDS.get(r.text) || convert(r.text, scheme) : r.text)).join('');
      }
    }
    return convert(String(text), scheme, override);
  }

  function convert(text, scheme, override) {
    if (!text) return '';
    const iso = scheme === 'iso';
    const s = iso ? null : resolveStyle(scheme, override);
    const toks = tokenize(String(text));
    let out = '';

    for (let i = 0; i < toks.length; i++) {
      const tok = toks[i];
      if (tok.t === 'o') { out += DIGITS.get(tok.ch) ?? tok.ch; continue; }

      const wordEnd = !toks[i + 1] || toks[i + 1].t === 'o';
      const vowelOf = (entry) => {
        if (iso) return entry[1];
        const v = entry[0];
        if (v[0] !== '@') return v;
        return v === '@aa' && wordEnd ? s.aaFinal : s[v.slice(1)];
      };

      if (tok.t === 'v') { out += vowelOf(V_IND.get(tok.ch)); continue; }

      let vowel = '';
      if (!tok.pure) vowel = tok.sign ? vowelOf(V_SIGN.get(tok.sign)) : 'a';

      if (iso) { out += ISO.get(tok.ch) + vowel; continue; }

      const prev = toks[i - 1] && toks[i - 1].t !== 'o' ? toks[i - 1] : null;
      const next = toks[i + 1] && toks[i + 1].t === 'c' ? toks[i + 1] : null;
      const cons = informalConsonant(tok, prev, next, s);
      // a consonant that prints nothing keeps no vowel either (only the doubled first half is silent)
      out += cons + (cons === '' && tok.pure ? '' : vowel);
    }
    return out;
  }

  return { transliterate, hasTamil, splitTamil, STYLES, OPTIONS };
});
