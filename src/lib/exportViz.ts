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
  footer: string[];
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

export async function buildSvg(o: ExportOpts) {
  const chartW = o.svg.width.baseVal.value;
  const chartH = o.svg.height.baseVal.value;
  const W = Math.max(chartW, 640);
  const pad = 24;
  const [logo, fonts] = await Promise.all([dataUrl('./avatars/logo.webp'), fontCss()]);

  // header
  let y = pad;
  let head = '';
  if (logo) head += `<image href="${logo}" x="${pad}" y="${y - 6}" width="64" height="64"/>`;
  const tx = logo ? pad + 78 : pad;
  head += `<text x="${tx}" y="${y + 24}" font-size="22" font-weight="800" fill="#003F72">${esc(o.title)}</text>`;
  head += `<text x="${tx}" y="${y + 45}" font-size="14" font-weight="700" fill="#0074b0">${esc(o.subtitle)}</text>`;
  y += 52 + 18;
  head += `<line x1="${pad}" x2="${W - pad}" y1="${y - 8}" y2="${y - 8}" stroke="#E1E4E8"/>`;
  for (const line of o.lines) {
    for (const l of wrap(line, W - pad * 2, 12.5)) { y += 17; head += `<text x="${pad}" y="${y}" font-size="12.5" fill="#33404d">${esc(l)}</text>`; }
  }
  y += 14;
  const chartY = y;

  // chart
  const clone = cloneChart(o.svg);
  const origin = o.svg.getBoundingClientRect();
  const labels = o.overlay ? overlayToSvg(o.overlay, origin) : '';
  const inner = clone.innerHTML;
  const chart = `<g transform="translate(${(W - chartW) / 2},${chartY})"><svg width="${chartW}" height="${chartH}" overflow="hidden">${inner}${labels}</svg></g>`;

  // footer
  let fy = chartY + chartH + 18;
  let foot = '';
  for (const line of o.footer) for (const l of wrap(line, W - pad * 2, 10.5)) { foot += `<text x="${pad}" y="${fy}" font-size="10.5" fill="#6b6f75">${esc(l)}</text>`; fy += 15; }
  const H = fy + pad - 8;

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

export async function exportViz(fmt: 'svg' | 'png', o: ExportOpts) {
  const { svg, W, H } = await buildSvg(o);
  if (fmt === 'svg') return save(new Blob([svg], { type: 'image/svg+xml' }), `${o.filename}.svg`);
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (blob) save(blob, `${o.filename}.png`);
}
