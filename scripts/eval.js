#!/usr/bin/env node
/*
 * Measure (and tune) Kannaadi's informal spellings against the Dakshina Tamil romanization lexicon.
 *
 *   node scripts/eval.js <train.tsv> [--dev <dev.tsv>] [--style tanglish|casual] [--tune] [--worst 40]
 *
 * The lexicon is TSV: native word <TAB> attested Latin spelling <TAB> count.
 * Get it from https://github.com/google-research-datasets/dakshina (ta/lexicons/ta.translit.sampled.*.tsv, CC BY-SA 4.0).
 * The data is only used to measure and tune; it is not part of this repo or the extension.
 *
 * Metrics (higher is better), all computed over the words in the file:
 *   weighted  share of all attestations (counted by how often people wrote them) that equal our output
 *   top1      share of words whose most-attested spelling equals our output
 *   any       share of words where our output is one of the attested spellings
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { transliterate, STYLES, OPTIONS } = require('../src/engine/transliterate.js');

const args = process.argv.slice(2);
const flag = (name) => args.includes('--' + name);
const opt = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const file = args.find((a, i) => !a.startsWith('--') && !['--dev', '--style', '--worst'].includes(args[i - 1]));
if (!file) {
  console.error('usage: node scripts/eval.js <train.tsv> [--dev <dev.tsv>] [--style tanglish|casual] [--tune] [--worst N]');
  process.exit(1);
}
const scheme = opt('style', 'tanglish');
if (!STYLES[scheme]) { console.error('--style must be tanglish or casual'); process.exit(1); }

function load(p) {
  const words = new Map();
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const [native, latin, count] = line.split('\t');
    if (!native || !latin) continue;
    const spellings = words.get(native) || new Map();
    const key = latin.trim().toLowerCase();
    spellings.set(key, (spellings.get(key) || 0) + (parseInt(count, 10) || 1));
    words.set(native, spellings);
  }
  return [...words].map(([native, spellings]) => {
    let total = 0;
    let best = '';
    let bestCount = -1;
    for (const [s, c] of spellings) { total += c; if (c > bestCount) { best = s; bestCount = c; } }
    return { native, spellings, total, best };
  });
}

// style === null scores the shipping pipeline (STYLES + the loanword list); an object scores the rules alone.
function score(words, style) {
  let hit = 0;
  let all = 0;
  let top1 = 0;
  let any = 0;
  for (const w of words) {
    const out = style ? transliterate(w.native, scheme, style) : transliterate(w.native, scheme);
    const c = w.spellings.get(out) || 0;
    hit += c;
    all += w.total;
    if (out === w.best) top1++;
    if (c) any++;
  }
  return { weighted: hit / all, top1: top1 / words.length, any: any / words.length };
}

const pct = (x) => (x * 100).toFixed(1).padStart(5) + '%';
const fmt = (r) => `weighted ${pct(r.weighted)} | top1 ${pct(r.top1)} | any ${pct(r.any)}`;

const train = load(file);
const devPath = opt('dev', null);
const dev = devPath ? load(devPath) : null;
console.log(`${scheme}: ${train.length} training words${dev ? `, ${dev.length} dev words` : ''}`);

let style = { ...STYLES[scheme] };
console.log('current  train:', fmt(score(train, style)));
if (dev) console.log('current  dev:  ', fmt(score(dev, style)));

if (flag('tune')) {
  if (scheme === 'casual') {
    console.error('\nCasual is Tanglish plus a few hand-picked lightenings (see STYLES in the engine); tune tanglish instead.');
    process.exit(1);
  }
  const allowed = 'tang';
  const keys = Object.keys(OPTIONS);
  let best = score(train, style).weighted;
  for (let pass = 1; pass <= 4; pass++) {
    let changed = false;
    for (const key of keys) {
      for (const value of OPTIONS[key][allowed]) {
        if (value === style[key]) continue;
        const trial = score(train, { ...style, [key]: value }).weighted;
        if (trial > best + 1e-9) { best = trial; style[key] = value; changed = true; }
      }
    }
    if (!changed) break;
  }
  console.log('\ntuned style:');
  for (const key of keys) {
    const was = STYLES[scheme][key];
    console.log(`  ${key.padEnd(8)} ${style[key].padEnd(7)} ${was === style[key] ? '' : `(was ${was})`}`);
  }
  console.log('tuned    train:', fmt(score(train, style)));
  if (dev) console.log('tuned    dev:  ', fmt(score(dev, style)));
  fs.writeFileSync(path.join(__dirname, `.tuned-${scheme}.json`), JSON.stringify(style, null, 2));
}

console.log('\nshipping pipeline (rules + loanword list):');
console.log('  train:', fmt(score(train, null)));
if (dev) console.log('  dev:  ', fmt(score(dev, null)));

const worst = parseInt(opt('worst', '0'), 10);
if (worst > 0) {
  console.log(`\nmost common words we spell differently from the top attested spelling:`);
  const rows = train
    .filter((w) => transliterate(w.native, scheme, style) !== w.best)
    .sort((a, b) => b.total - a.total)
    .slice(0, worst);
  for (const w of rows) {
    console.log(`  ${w.native}  ours=${transliterate(w.native, scheme, style).padEnd(14)} top=${w.best.padEnd(14)} (${w.total})`);
  }
}
