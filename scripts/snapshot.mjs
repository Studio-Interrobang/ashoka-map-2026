#!/usr/bin/env node
/**
 * Snapshot the "Map data" tab of the Ashoka Google Sheet into public/data.json.
 *
 * Sources (first one available wins):
 *   --csv <path>                    local CSV export of the "Map data" tab (dev)
 *   GOOGLE_ACCESS_TOKEN env          short-lived token for the read-only service account (CI: keyless
 *                                    GitHub → Google sign-in, Workload Identity Federation)
 *   GOOGLE_SERVICE_ACCOUNT_JSON env  service account key (fallback; key creation is blocked by org policy)
 * The service account has Viewer access to the feed sheet only.
 *
 * Safety: only columns in ALLOWLIST are read; the PII guard fails the run if
 * anything that looks like a phone number or personal data slips through.
 * On validation failure nothing is written, so the last good data.json stays live.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// "Ashoka map feed (public columns only)": a separate sheet whose A1 holds an IMPORTRANGE of the
// allowlisted "Map data" columns from the main sheet. The service account is shared on this feed
// ONLY, so its key can never reach the main sheet (and the survey's personal data).
const SHEET_ID = process.env.SHEET_ID || '1W8aO3nVmdCZQPaICDZ_qoziCuYjCif8V8bag9K-V_Ys';
const RANGE = process.env.SHEET_RANGE || 'A1:Z400'; // first tab of the feed
const OUT = path.resolve('public/data.json');

// header in sheet -> key in data.json. Aliases allowed (sheet headers have drifted before).
const ALLOWLIST = {
  id: ['ID'],
  name: ['Official Name'],
  short: ['Short Name'],
  c1: ['Strengthening Democratic Processes'],
  c2: ['Creating New Pathways for Civic Participation'],
  c3: ['Countering Polarization and Disinformation'],
  c4: ['Changemaker-Makers'],
  reach: ['Scale of work', 'Impact level'],
  audience: ['Main audience'],
  year: ['Establishment Year'],
  descEn: ['Description'],
  descRo: ['Descriere'],
  website: ['Website'],
  contact: ['General Contact'],
  county: ['County'],
  uat: ['UAT'],
  lat: ['Latitude'],
  lon: ['Longitude'],
  outcomesRo: ['Impact RO'],
  outcomesEn: ['Impact EN'],
  activityRo: ['Activity sector RO'],
};
const FORBIDDEN_HEADER = /(telefon|phone|prenume|reprezentant|e-?mail(?!.*general)|nume și)/i;

// Activity types are parsed from the canonical Romanian option labels (EN column is inconsistent).
const ACTIVITIES = [
  ['advocacy', /advocacy|pledoarie/i],
  ['watchdog', /watchdog|monitorizarea/i],
  ['civic_ed', /educa[țt]ie civic/i],
  ['mobilisation', /mobilizare social/i],
  ['research', /cercetare/i],
  ['legal', /suport juridic|litigii/i],
  ['media', /media|jurnalism/i],
  ['other', /alt[aă] activitate/i],
];
const OUTCOMES = [
  ['engagement', /implic[aă]rii civice/i],
  ['mindsets', /mentalit/i],
  ['policy', /politicilor publice/i],
  ['access', /accesului la servicii/i],
  ['scaling', /scalarea|replicarea/i],
  ['quality', /calit[aă][țt]ii vie[țt]ii/i],
  ['leaders', /lideri/i],
  ['partnerships', /colabor[aă]rii [șs]i parteneriatelor/i],
  ['digital', /digitalizare/i],
  ['visibility', /vizibilitate/i],
  ['decisions', /decizii publice/i],
];

const RO_BOUNDS = { latMin: 43.5, latMax: 48.4, lonMin: 20.1, lonMax: 29.8 };
const KNOWN_COMBOS = new Set(['C1', 'C2', 'C4', 'C1C2', 'C1C3', 'C1C4', 'C2C3', 'C2C4', 'C3C4', 'C1C2C4', 'C3', 'C1C2C3', 'C1C3C4', 'C2C3C4', 'C1C2C3C4']);
const REACH = new Set(['Local', 'National', 'International']);

// ---------- input ----------
function parseCSV(text) {
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function fromServiceAccount(json) {
  const sa = JSON.parse(json);
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key).toString('base64url');
  const tok = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  }).then((r) => r.json());
  if (!tok.access_token) throw new Error('Token error: ' + JSON.stringify(tok));
  return fromToken(tok.access_token);
}

async function fromToken(token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json());
  if (!res.values) throw new Error('Sheets API error: ' + JSON.stringify(res).slice(0, 300));
  return res.values;
}

// ---------- transform ----------
const clean = (v) => (v ?? '').toString().replace(/\s+/g, ' ').trim();
const num = (v) => { const n = parseFloat(clean(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const tags = (text, defs) => defs.filter(([, re]) => re.test(text)).map(([k]) => k);
const url = (v) => { const s = clean(v); if (!s) return ''; return /^https?:\/\//i.test(s) ? s : `https://${s}`; };

function transform(rows) {
  const header = rows[0].map(clean);
  for (const h of header) if (h && FORBIDDEN_HEADER.test(h) && h !== 'General Contact') throw new Error(`PII guard: forbidden header "${h}" in source range`);
  const col = {};
  for (const [key, names] of Object.entries(ALLOWLIST)) {
    const idx = header.findIndex((h) => names.includes(h));
    if (idx < 0) throw new Error(`Missing column for "${key}" (expected one of ${names.join(' / ')})`);
    col[key] = idx;
  }
  const errors = []; const warnings = []; const seen = new Set(); const orgs = [];
  rows.slice(1).forEach((r, i) => {
    const g = (k) => clean(r[col[k]]);
    const id = g('id');
    if (!id) return;
    const line = i + 2;
    if (seen.has(id)) errors.push(`row ${line}: duplicate ID ${id}`);
    seen.add(id);
    const clusters = ['c1', 'c2', 'c3', 'c4'].filter((k) => g(k)).map((k) => k.toUpperCase());
    const reach = g('reach');
    const lat = num(r[col.lat]); const lon = num(r[col.lon]);
    if (!clusters.length) errors.push(`row ${line} (${g('short')}): no cluster`);
    if (!KNOWN_COMBOS.has(clusters.join(''))) errors.push(`row ${line}: unknown cluster combo ${clusters.join('')}`);
    if (!REACH.has(reach)) errors.push(`row ${line} (${g('short')}): unknown reach "${reach}"`);
    if (lat == null || lon == null || lat < RO_BOUNDS.latMin || lat > RO_BOUNDS.latMax || lon < RO_BOUNDS.lonMin || lon > RO_BOUNDS.lonMax)
      errors.push(`row ${line} (${g('short')}): coordinates outside Romania (${lat}, ${lon})`);
    const yearMatch = g('year').match(/\d{4}/);
    if (!yearMatch) warnings.push(`row ${line} (${g('short')}): no establishment year`);
    const contact = g('contact');
    if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) warnings.push(`row ${line}: odd contact "${contact}"`);
    const actText = g('activityRo');
    const outText = g('outcomesRo');
    orgs.push({
      id, name: g('name'), short: g('short') || g('name'),
      clusters, avatar: `${clusters.join('')}_${reach}`, reach,
      year: yearMatch ? +yearMatch[0] : null,
      audience: g('audience'),
      desc: { en: g('descEn'), ro: g('descRo') || g('descEn') },
      website: url(g('website')), contact,
      county: g('county'), uat: g('uat'), lat, lon,
      activities: tags(actText, ACTIVITIES),
      outcomes: tags(outText, OUTCOMES),
    });
  });
  // PII guard on values: phone-like numbers anywhere in free text
  const phone = /(\+?4?0[\s.-]?7\d{2}[\s.-]?\d{3}[\s.-]?\d{3})/;
  for (const o of orgs) {
    const blob = [o.name, o.short, o.audience, o.desc.en, o.desc.ro, o.website].join(' | ');
    if (phone.test(blob)) errors.push(`PII guard: phone-like number in ${o.short}`);
    if (/@/.test(blob.replace(o.website, ''))) errors.push(`PII guard: email-like value outside contact in ${o.short}`);
  }
  return { orgs, errors, warnings };
}

// ---------- main ----------
const argv = process.argv.slice(2);
const csvIdx = argv.indexOf('--csv');
const checkOnly = argv.includes('--check');
let rows;
if (csvIdx >= 0) rows = parseCSV(fs.readFileSync(argv[csvIdx + 1], 'utf8'));
else if (process.env.GOOGLE_ACCESS_TOKEN) rows = await fromToken(process.env.GOOGLE_ACCESS_TOKEN);
else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) rows = await fromServiceAccount(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
else { console.error('No source: pass --csv <file> or set GOOGLE_ACCESS_TOKEN / GOOGLE_SERVICE_ACCOUNT_JSON'); process.exit(2); }

const { orgs, errors, warnings } = transform(rows);
warnings.forEach((w) => console.warn('warn:', w));
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
if (prev && orgs.length < prev.orgs.length * 0.8) errors.push(`row count dropped from ${prev.orgs.length} to ${orgs.length} (>20%)`);
if (errors.length) { errors.forEach((e) => console.error('ERROR:', e)); console.error(`\n${errors.length} error(s); data.json NOT updated.`); process.exit(1); }

const data = { updated: new Date().toISOString(), count: orgs.length, orgs: orgs.sort((a, b) => a.short.localeCompare(b.short, 'ro')) };
if (!checkOnly) {
  const json = JSON.stringify(data);
  const changed = !prev || JSON.stringify({ ...prev, updated: 0 }) !== JSON.stringify({ ...data, updated: 0 });
  if (changed) { fs.writeFileSync(OUT, json); console.log(`Wrote ${OUT}: ${orgs.length} orgs, ${(json.length / 1024).toFixed(1)} KB`); }
  else console.log(`No changes (${orgs.length} orgs).`);
} else console.log(`OK: ${orgs.length} orgs valid.`);
