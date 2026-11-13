#!/usr/bin/env node
// Downscale the 30 final badge PNGs (6000px) into small WebP files for the web.
// Usage: node scripts/build-avatars.mjs "<path to Final Files/Avatar>"
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const src = process.argv[2];
if (!src) { console.error('Pass the folder with the 6000px badge PNGs'); process.exit(2); }
const out = path.resolve('public/avatars');
fs.mkdirSync(out, { recursive: true });
const files = fs.readdirSync(src).filter((f) => f.endsWith('.png'));
for (const f of files) {
  const base = f.replace(/\.png$/, '');
  const img = sharp(path.join(src, f));
  await img.clone().resize(96, 96).webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(out, `${base}-s.webp`));
  await img.clone().resize(320, 320).webp({ quality: 84, alphaQuality: 90 }).toFile(path.join(out, `${base}-l.webp`));
}
console.log(`Built ${files.length * 2} avatar files in ${out}`);
