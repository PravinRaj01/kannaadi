#!/usr/bin/env node
/*
 * Build the store upload zip: dist/kannaadi-<version>.zip
 *
 *   node scripts/package.js        (or: npm run package)
 *
 * Only what the browser needs goes in: manifest.json, src/, icons/ and LICENSE. Tests, scripts, the demo
 * page and local notes stay out. Files come from the working tree, so run it from a clean commit.
 *
 * The zip is written by hand (about 40 lines, Node's zlib only) so entry names always use forward slashes and
 * the output is byte-for-byte reproducible. Windows' Compress-Archive writes backslashes, which stores reject.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (manifest.version !== pkg.version) {
  console.error(`version mismatch: manifest ${manifest.version} vs package.json ${pkg.version}`);
  process.exit(1);
}

const include = ['manifest.json', 'src', 'icons', 'LICENSE'];
const files = [];
function walk(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) { console.error('missing: ' + rel); process.exit(1); }
  if (fs.statSync(full).isDirectory()) fs.readdirSync(full).sort().forEach((n) => walk(rel + '/' + n));
  else files.push(rel);
}
include.forEach(walk);

// every file the manifest points at must be in the zip
const referenced = [
  manifest.background && manifest.background.service_worker,
  manifest.action && manifest.action.default_popup,
  manifest.side_panel && manifest.side_panel.default_path,
  ...Object.values(manifest.icons || {}),
  ...(manifest.content_scripts || []).flatMap((c) => [...(c.js || []), ...(c.css || [])]),
  ...(manifest.web_accessible_resources || []).flatMap((w) => w.resources),
].filter(Boolean);
for (const f of referenced) {
  if (!files.includes(f)) { console.error('manifest references a file that is not packaged: ' + f); process.exit(1); }
}

// ---- minimal zip writer (deflate, UTF-8 names, fixed timestamp) ----
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;   // 2026-01-01
const DOS_TIME = 0;
const parts = [];
const central = [];
let offset = 0;
for (const name of files) {
  const data = fs.readFileSync(path.join(root, name));
  const packed = zlib.deflateRawSync(data, { level: 9 });
  const nameBuf = Buffer.from(name, 'utf8');
  const crc = zlib.crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);            // version needed
  local.writeUInt16LE(0x0800, 6);        // UTF-8 names
  local.writeUInt16LE(8, 8);             // deflate
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  parts.push(local, nameBuf, packed);

  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(0x02014b50, 0);
  cd.writeUInt16LE(20, 4);               // version made by
  cd.writeUInt16LE(20, 6);               // version needed
  cd.writeUInt16LE(0x0800, 8);
  cd.writeUInt16LE(8, 10);
  cd.writeUInt16LE(DOS_TIME, 12);
  cd.writeUInt16LE(DOS_DATE, 14);
  cd.writeUInt32LE(crc, 16);
  cd.writeUInt32LE(packed.length, 20);
  cd.writeUInt32LE(data.length, 24);
  cd.writeUInt16LE(nameBuf.length, 28);
  cd.writeUInt32LE(offset, 42);          // local header offset
  central.push(cd, nameBuf);

  offset += local.length + nameBuf.length + packed.length;
}
const cdBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cdBuf.length, 12);
end.writeUInt32LE(offset, 16);

const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
const zip = path.join(dist, `kannaadi-${manifest.version}.zip`);
fs.writeFileSync(zip, Buffer.concat([...parts, cdBuf, end]));

console.log(`\n${zip}`);
console.log(`${files.length} files, ${(fs.statSync(zip).size / 1024).toFixed(1)} KB`);
for (const f of files) console.log('  ' + f);
