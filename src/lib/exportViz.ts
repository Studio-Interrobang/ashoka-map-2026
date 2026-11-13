/**
 * Export the current Map / Clusters visual as SVG or PNG:
 * logo + title, a line describing the active filters, the chart itself, then source credits.
 * Works from the live DOM so the export matches what is on screen (zoom level, filters, grouping).
 */

const NS = 'http://www.w3.org/2000/svg';
const STYLE_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'opacity', 'font-size', 'font-weight', 'font-family', 'paint-order'];
const FONT = "'Noto Sans', 'Helvetica Neue', Arial, sans-serif";

export interface ExportOpts {
  svg: SVGSVGElement;
  /** element holding HTML labels positioned over the svg (Clusters view) */
  overlay?: HTMLElement | null;
  title: string;
  subtitle: string;
  lines: string[]; // filter description
  /** summary band: filtered total + per-cluster counts (as in the on-screen strip) */
  summary?: { total: number; label: string; clusters: { c: string; n: number; name: string; tone: string }[] };
  footer: string[];
  /** phones: export in a social-media frame, height = width × social (4:5 → 1.25), 1080×1350 PNG */
  social?: number;
  /** re-lay the chart out for the image's chart area (w × h) before it is copied */
  fitTo?: (w: number, h: number) => Promise<void>;
  filename: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function wrap(text: string, maxW: number, size: number) {
  const cw = size * 0.56; // average glyph width for Noto Sans
  const out: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length * cw > maxW && cur) { out.push(cur); cur = word; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

async function dataUrl(url: string) {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(blob); });
  } catch { return ''; }
}

/** Noto Sans (latin + latin-ext for ș/ț/ă) embedded as data URLs so the export keeps the brand font. */
let fontCache: Promise<string> | null = null;
function fontCss() {
  fontCache ??= (async () => {
    try {
      const css = await (await fetch('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700;800&display=swap')).text();
      const blocks = css.split('/* ').filter((b) => /^latin(-ext)? \*\//.test(b));
      const cache = new Map<string, string>();
      let out = '';
      for (const b of blocks) {
        const url = b.match(/url\(([^)]+)\)/)?.[1];
        if (!url) continue;
        if (!cache.has(url)) cache.set(url, await dataUrl(url));
        out += b.replace(/^[^*]*\*\//, '').replace(url, cache.get(url)!);
      }
      return out;
    } catch { return ''; }
  })();
  return fontCache;
}

/** Copy the chart, inlining computed styles (Svelte styles are scoped classes) and CSS transforms. */
function cloneChart(src: SVGSVGElement) {
  const clone = src.cloneNode(true) as SVGSVGElement;
  const a = src.querySelectorAll('*');
  const b = clone.querySelectorAll('*');
  a.forEach((el, i) => {
    const c = b[i] as SVGElement;
    const cs = getComputedStyle(el);
    let style = '';
    for (const p of STYLE_PROPS) { const v = cs.getPropertyValue(p); if (v) style += `${p}:${v};`; }
    const m = (el as SVGElement).style?.transform?.match(/translate\(\s*([-\d.e]+)px,\s*([-\d.e]+)px\)/);
    if (m) c.setAttribute('transform', `translate(${m[1]},${m[2]})`);
    c.setAttribute('style', style);
    for (const at of ['class', 'tabindex', 'role', 'aria-label']) c.removeAttribute(at);
  });
  clone.querySelectorAll('title, .hit').forEach((n) => n.remove());
  return clone;
}

/** HTML labels → svg text, word by word at their exact on-screen positions. */
function overlayToSvg(overlay: HTMLElement, origin: DOMRect) {
  let out = '';
  for (const dot of overlay.querySelectorAll<HTMLElement>('.udots i')) {
    const r = dot.getBoundingClientRect();
    out += `<circle cx="${r.left + r.width / 2 - origin.left}" cy="${r.top + r.height / 2 - origin.top}" r="${r.width / 2}" fill="${getComputedStyle(dot).backgroundColor}"/>`;
  }
  const range = document.createRange();
  for (const label of overlay.querySelectorAll<HTMLElement>('.ulabel')) {
    const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const txt = node.textContent ?? '';
      const cs = getComputedStyle(node.parentElement!);
      const size = parseFloat(cs.fontSize);
      for (const m of txt.matchAll(/\S+/g)) {
        range.setStart(node, m.index!);
        range.setEnd(node, m.index! + m[0].length);
        const r = range.getBoundingClientRect();
        out += `<text x="${r.left - origin.left}" y="${r.top - origin.top + size * 0.95}" font-size="${size}" font-weight="${cs.fontWeight}" fill="${cs.color}" font-family="${esc(FONT)}">${esc(m[0])}</text>`;
      }
    }
  }
  return out;
}

/** Visible content box of the chart (svg shapes + HTML labels), in chart coordinates. */
function contentBox(svg: SVGSVGElement, overlay: HTMLElement | null | undefined) {
  const W = svg.width.baseVal.value; const H = svg.height.baseVal.value;
  // measure the static layers (county shapes / group bubbles); dots may still be mid-animation
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (const g of svg.querySelectorAll<SVGGraphicsElement>(':scope > .counties, :scope > .groups')) {
    const b = g.getBBox();
    if (!b.width) continue;
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
  }
  if (x1 <= x0) { x0 = 0; y0 = 0; x1 = W; y1 = H; }
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
  if (overlay) {
    const o = svg.getBoundingClientRect();
    for (const l of overlay.querySelectorAll<HTMLElement>('.ulabel')) {
      const r = l.getBoundingClientRect();
      x0 = Math.min(x0, r.left - o.left); y0 = Math.min(y0, r.top - o.top); x1 = Math.max(x1, r.right - o.left); y1 = Math.max(y1, r.bottom - o.top);
    }
  }
  const p = 6;
  return { x: x0 - p, y: y0 - p, w: x1 - x0 + 2 * p, h: y1 - y0 + 2 * p };
}

export async function buildSvg(o: ExportOpts) {
  // social format crops to the content so the chart can fill the frame
  let box = contentBox(o.svg, o.overlay);
  let chartW = box.w;
  let chartH = box.h;
  // social format (phones): fixed width, height = width × aspect; otherwise width follows the chart
  const W = o.social ? 540 : Math.max(o.svg.width.baseVal.value, 640);
  const compact = W < 700;
  const pad = 24;
  const [logo, fonts] = await Promise.all([dataUrl('./avatars/logo.webp'), fontCss()]);

  // header
  let y = pad;
  let head = '';
  const logoS = compact ? 56 : 64;
  if (logo) head += `<image href="${logo}" x="${pad}" y="${y - 6}" width="${logoS}" height="${logoS}"/>`;
  const tx = logo ? pad + logoS + 14 : pad;
  const titleLines = wrap(o.title, W - tx - pad, 22 * 1.08); // bold runs wider
  titleLines.forEach((l, i) => { head += `<text x="${tx}" y="${y + 24 + i * 26}" font-size="22" font-weight="800" fill="#003F72">${esc(l)}</text>`; });
  const subY = y + 45 + (titleLines.length - 1) * 26;
  head += `<text x="${tx}" y="${subY}" font-size="14" font-weight="700" fill="#0074b0">${esc(o.subtitle)}</text>`;
  y = Math.max(y + logoS, subY) + 18;
  head += `<line x1="${pad}" x2="${W - pad}" y1="${y - 8}" y2="${y - 8}" stroke="#E1E4E8"/>`;
  y += 6;

  // summary band
  if (o.summary) {
    const icons = await Promise.all(o.summary.clusters.map((c) => dataUrl(`./avatars/icon-${c.c}.webp`)));
    const bw = W - pad * 2;
    const totalW = compact ? 104 : 172;
    const cols = bw > 900 ? 4 : 2;
    const cellW = (bw - totalW - 16) / cols;
    const maxLines = compact ? 3 : 2;
    const rows = Math.ceil(o.summary.clusters.length / cols);
    const rowH = compact ? 44 : 36;
    const bh = rows * rowH + 16;
    head += `<rect x="${pad}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="#F3F4F6"/>`;
    head += `<text x="${pad + 12}" y="${y + bh / 2 + 4}" font-size="32" font-weight="800" fill="#0074b0">${o.summary.total}</text>`;
    wrap(o.summary.label, totalW - 20, 12 * 1.05).forEach((l, i) => {
      head += `<text x="${pad + 12}" y="${y + bh / 2 + 22 + i * 14}" font-size="12" font-weight="700" fill="#1a1f24">${esc(l)}</text>`;
    });
    head += `<line x1="${pad + totalW}" x2="${pad + totalW}" y1="${y + 10}" y2="${y + bh - 10}" stroke="#DDE0E4"/>`;
    o.summary.clusters.forEach((c, i) => {
      const cx = pad + totalW + 10 + (i % cols) * cellW;
      const cy = y + 8 + Math.floor(i / cols) * rowH;
      const mid = cy + rowH / 2;
      if (icons[i]) head += `<image href="${icons[i]}" x="${cx}" y="${mid - 10}" width="20" height="20"/>`;
      head += `<text x="${cx + 25}" y="${mid + 6}" font-size="17" font-weight="800" fill="${c.tone}">${c.n}</text>`;
      const nx = cx + (compact ? 50 : 58);
      const nameLines = wrap(c.name.toUpperCase(), cellW - (nx - cx) - 8, 9.5 * 1.22).slice(0, maxLines); // uppercase runs wider
      nameLines.forEach((l, j) => {
        const ly = mid + 3.5 + (j - (nameLines.length - 1) / 2) * 11.5;
        head += `<text x="${nx}" y="${ly}" font-size="9.5" letter-spacing="0.2" fill="#1a1f24">${esc(l)}</text>`;
      });
    });
    y += bh;
  }
  // filter summary, under the cluster KPIs
  for (const line of o.lines) {
    for (const l of wrap(line, W - pad * 2, 12.5)) { y += 18; head += `<text x="${pad}" y="${y}" font-size="12.5" fill="#33404d">${esc(l)}</text>`; }
  }
  y += 16;
  const chartY = y;

  // footer (measured first so the social format can pin it to the bottom)
  const footLines = o.footer.flatMap((line) => wrap(line, W - pad * 2, 10.5));
  const footH = footLines.length * 15 + 18;

  // chart: actual size, or scaled to fill the space left in the 4:5 frame
  let H: number; let cw = chartW; let ch = chartH;
  if (o.social && o.fitTo) {
    await o.fitTo(W - pad * 2, Math.round(W * o.social) - chartY - footH - pad + 8);
    box = contentBox(o.svg, o.overlay);
    chartW = box.w; chartH = box.h; cw = chartW; ch = chartH;
  }
  if (o.social) {
    H = Math.round(W * o.social);
    const availH = H - chartY - footH - pad + 8;
    const k = Math.min((W - pad * 2) / chartW, availH / chartH);
    cw = chartW * k; ch = chartH * k;
  } else {
    // fill the content width; cap the height so a tall Clusters view doesn't become a poster
    const k = Math.min((W - pad * 2) / chartW, Math.max(1, 1100 / chartH));
    cw = chartW * k; ch = chartH * k;
    H = chartY + ch + 12 + footH + pad - 8;
  }
  const clone = cloneChart(o.svg);
  const origin = o.svg.getBoundingClientRect();
  const labels = o.overlay ? overlayToSvg(o.overlay, origin) : '';
  const chartTop = o.social ? chartY + (H - footH - pad + 8 - chartY - ch) / 2 : chartY;
  const chart = `<svg x="${(W - cw) / 2}" y="${chartTop}" width="${cw}" height="${ch}" viewBox="${box.x} ${box.y} ${chartW} ${chartH}" overflow="hidden">${clone.innerHTML}${labels}</svg>`;

  let fy = H - pad + 8 - footH + 18;
  let foot = '';
  for (const l of footLines) { foot += `<text x="${pad}" y="${fy}" font-size="10.5" fill="#6b6f75">${esc(l)}</text>`; fy += 15; }

  const svg = `<svg xmlns="${NS}" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${esc(FONT)}">` +
    (fonts ? `<defs><style>${fonts}</style></defs>` : '') + `<rect width="100%" height="100%" fill="#fff"/>${head}${chart}${foot}</svg>`;
  return { svg, W, H };
}

function save(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function exportViz(fmt: 'png' | 'jpg', o: ExportOpts) {
  const { svg, W, H } = await buildSvg(o);
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const scale = W === 540 ? 1080 / 540 : 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise<Blob | null>((res) => (fmt === 'jpg' ? canvas.toBlob(res, 'image/jpeg', 0.92) : canvas.toBlob(res, 'image/png')));
  if (blob) save(blob, `${o.filename}.${fmt}`);
}
