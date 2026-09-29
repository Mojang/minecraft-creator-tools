#!/usr/bin/env node
// Writes a placeholder pack_icon.png (square, power-of-two size) into one or more pack folders.
//
// Usage:
//   node make-pack-icon.mjs <pack-folder> [<pack-folder> ...] [--color #3C8527] [--size 64] [--overwrite]
//
// A pack folder is one that contains manifest.json (for example behavior_packs/my_pack).
// Existing pack_icon.png files are kept unless --overwrite is passed.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Invalid color "${hex}". Use #RRGGBB.`);
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

const shade = (rgb, f) => rgb.map((c) => Math.max(0, Math.min(255, Math.round(c * f))));

function makeIcon(size, rgb) {
  const border = Math.max(1, Math.round(size / 16));
  const cell = Math.max(1, Math.round(size / 8));
  const dark = shade(rgb, 0.6);
  const light = shade(rgb, 1.15);
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      const onBorder = x < border || y < border || x >= size - border || y >= size - border;
      const checker = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      const [r, g, b] = onBorder ? dark : checker ? light : rgb;
      row.set([r, g, b, 255], 1 + x * 4);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function main() {
  const argv = process.argv.slice(2);
  const folders = [];
  let color = "#3C8527";
  let size = 64;
  let overwrite = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--color") color = argv[++i];
    else if (argv[i] === "--size") size = Number(argv[++i]);
    else if (argv[i] === "--overwrite") overwrite = true;
    else folders.push(argv[i]);
  }

  if (folders.length === 0) {
    console.log("Usage: node make-pack-icon.mjs <pack-folder> [...] [--color #RRGGBB] [--size 64] [--overwrite]");
    process.exit(2);
  }
  if (![2, 4, 8, 16, 32, 64, 128, 256].includes(size)) {
    console.error("--size must be a power of two between 2 and 256.");
    process.exit(2);
  }

  const png = makeIcon(size, parseHex(color));
  let failed = false;
  for (const folder of folders) {
    const dir = path.resolve(folder);
    if (!fs.existsSync(path.join(dir, "manifest.json"))) {
      console.error(`Skipped ${dir}: no manifest.json (pass a pack folder, not the project root).`);
      failed = true;
      continue;
    }
    const target = path.join(dir, "pack_icon.png");
    if (fs.existsSync(target) && !overwrite) {
      console.log(`Kept existing ${target} (pass --overwrite to replace it).`);
      continue;
    }
    fs.writeFileSync(target, png);
    console.log(`Wrote ${target} (${size}x${size}).`);
  }
  process.exit(failed ? 1 : 0);
}

main();
