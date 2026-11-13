# Ashoka · Changemaking Organization Map 2026

Embeddable story + light dashboard of Romania's 127 civic changemaking organisations (Ashoka Romania, 2026).
Replaces the Flourish stories (EN 3713289 / RO 3743784).

- `index.html` — the embeddable app (`?lang=ro|en`, `#view=table`, `#org=<ID>`)
- `lab.html` — **Map Lab**: compare map variants at different embed widths (`?lab=1` shows the variant switcher)
- `public/embed.js` — optional 1 KB helper for responsive height

## Embed

Option A (recommended, like Flourish):
```html
<iframe data-ashoka-map src="https://razvanzamfi.github.io/ashoka-map-2026/?lang=ro" title="Harta Organizațiilor Changemaker 2026" style="width:100%;height:780px;border:0" loading="lazy" allow="fullscreen"></iframe>
<script src="https://razvanzamfi.github.io/ashoka-map-2026/embed.js" async></script>
```
Option B (iframe only): the same `<iframe>` without the script. It works at a fixed height of 780px.

## Data

The Google Sheet stays the single source of truth. Only the **Map data** tab is read; the Survey data tab (with personal data) is never touched.

- `node scripts/snapshot.mjs --csv data/raw/map-data.csv` builds data from a local CSV export.
- In CI, the GitHub Action reads the sheet every 6 hours with a read-only service account (secret `GOOGLE_SERVICE_ACCOUNT_JSON`). It validates the data and runs a PII guard. If either check fails, it keeps the last good `public/data.json` and opens an issue.
- "Run workflow" in GitHub Actions triggers an immediate update.
- `node scripts/build-avatars.mjs "<Final Files/Avatar>"` rebuilds the web avatars from the 6000px badges.

## Dev
```
npm i && npm run dev   # http://localhost:5173/lab.html
```

County boundaries © geo-spatial.org (CC BY-SA 4.0), via National-Youth-Foundation/harta-romania-uat.
