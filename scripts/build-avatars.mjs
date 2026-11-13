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

// ---- Derived icons ----
// icon-C1..C4: one full badge per cluster (there is no single-C3 badge, so C3 is built
// by mirroring the C3 half of C1C3_National, whose right half is C3).
// logo: one quarter slice per cluster (C1 top-left, C2 top-right, C3 bottom-right, C4 bottom-left).
const S = 1600; // working size
const load = (n) => sharp(path.join(src, `${n}.png`)).resize(S, S).png().toBuffer();
const [b1, b2, b4, b13] = await Promise.all(['C1_National', 'C2_National', 'C4_National', 'C1C3_National'].map(load));
const half = S / 2;
const rightRaw = await sharp(b13).extract({ left: half, top: 0, width: half, height: S }).raw().toBuffer({ resolveWithObject: true });
// remove the few C1 (navy) pixels that cross the seam: paint blue-dominant pixels with the disc grey
{
  const px = rightRaw.data;
  // the badge disc is #D7D5C9 at ~50% alpha
  const disc = [215, 213, 201, 128];
  for (let i = 0; i < px.length; i += 4) {
    const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
    if (px[i + 3] > 0 && b > g + 25 && b > r + 40) { px[i] = disc[0]; px[i + 1] = disc[1]; px[i + 2] = disc[2]; px[i + 3] = disc[3]; }
  }
}
const rightC3 = await sharp(rightRaw.data, { raw: rightRaw.info }).png().toBuffer();
const c3 = await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: rightC3, left: half, top: 0 }, { input: await sharp(rightC3).flop().toBuffer(), left: 0, top: 0 }])
  .png().toBuffer();
const icons = { C1: b1, C2: b2, C3: c3, C4: b4 };
for (const [k, buf] of Object.entries(icons)) {
  await sharp(buf).resize(160, 160).webp({ quality: 85, alphaQuality: 90 }).toFile(path.join(out, `icon-${k}.webp`));
}
const q = (buf, left, top) => sharp(buf).extract({ left, top, width: half, height: half }).toBuffer();
const logo = await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    { input: await q(b1, 0, 0), left: 0, top: 0 },
    { input: await q(b2, half, 0), left: half, top: 0 },
    { input: await q(c3, half, half), left: half, top: half },
    { input: await q(b4, 0, half), left: 0, top: half },
  ]).png().toBuffer();
await sharp(logo).resize(192, 192).webp({ quality: 88, alphaQuality: 95 }).toFile(path.join(out, 'logo.webp'));
await sharp(logo).resize(512, 512).png().toFile(path.resolve('public/logo.png'));
// quad-C1..C4: each logo slice alone on a full-size transparent canvas (stacked, they form the logo) for the walkthrough
const quads = { C1: [b1, 0, 0], C2: [b2, half, 0], C3: [c3, half, half], C4: [b4, 0, half] };
for (const [k, [buf, left, top]] of Object.entries(quads)) {
  const layer = await sharp({ create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await q(buf, left, top), left, top }]).png().toBuffer();
  await sharp(layer).resize(320, 320).webp({ quality: 85, alphaQuality: 90 }).toFile(path.join(out, `quad-${k}.webp`));
}
console.log('Built cluster icons + logo + quad slices');
