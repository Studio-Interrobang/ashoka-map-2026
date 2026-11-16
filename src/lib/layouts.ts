import { geoMercator, geoPath, type GeoProjection } from 'd3-geo';
import { packSiblings, packEnclose } from 'd3-hierarchy';
import { forceSimulation, forceCollide, forceX, forceY } from 'd3-force';
import type { Counties } from './data';
import { norm } from './data';
import type { GroupBy, Org, Variant } from './types';
import { REACHES } from './types';

export interface NodePos { x: number; y: number; r: number }
export interface Group {
  key: string; label: string; n: number;
  x: number; y: number; r: number;
  ax: number; ay: number; // geographic anchor
  empty?: boolean;
  px?: number; py?: number; // true location (leader line)
  lw?: number; // label width (clusters view)
}
export interface Layout {
  nodes: Map<string, NodePos>;
  groups: Group[];
  projection: GeoProjection | null;
  countyCounts: Map<string, number>;
  contentH?: number; // clusters view may be taller than the stage (scrolls)
  instances?: { key: string; id: string }[]; // clusters view: one org may appear in several groups
}

export function nodeRadius(w: number, h: number) {
  return Math.max(5.5, Math.min(14, Math.min(w, h * 1.45) / 68));
}

export function fitProjection(counties: Counties, x0: number, y0: number, x1: number, y1: number) {
  return geoMercator().fitExtent([[x0, y0], [x1, y1]], counties);
}

const byAvatar = (a: Org, b: Org) => a.avatar.localeCompare(b.avatar);

/** Pack a set of equal circles; returns offsets relative to enclosing circle centre. */
export function packEqual(orgs: Org[], r: number, gap = 0.8) {
  const circles = [...orgs].sort(byAvatar).map((o) => ({ id: o.id, r: r + gap, x: 0, y: 0 }));
  packSiblings(circles);
  const enc = circles.length ? packEnclose(circles)! : { x: 0, y: 0, r: 0 };
  return { circles: circles.map((c) => ({ id: c.id, dx: c.x - enc.x, dy: c.y - enc.y })), R: enc.r };
}

/** Push groups apart while keeping them near their geographic anchors. */
function relax(groups: Group[], w: number, h: number, pad = 3, fixed = new Set<string>()) {
  type N = Group & { fx?: number; fy?: number; vx?: number; vy?: number };
  const nodes = groups as N[];
  for (const g of nodes) {
    g.x = g.ax; g.y = g.ay;
    if (fixed.has(g.key)) { g.fx = g.x; g.fy = g.y; }
  }
  const sim = forceSimulation(nodes)
    .force('x', forceX<N>((d) => d.ax).strength(0.25))
    .force('y', forceY<N>((d) => d.ay).strength(0.25))
    .force('c', forceCollide<N>((d) => d.r + pad).strength(1).iterations(4))
    .stop();
  for (let i = 0; i < 260; i++) {
    sim.tick();
    for (const g of nodes) {
      g.x = Math.max(g.r + 2, Math.min(w - g.r - 2, g.x));
      g.y = Math.max(g.r + 2, Math.min(h - g.r - 2, g.y));
    }
  }
  for (const g of nodes) { delete g.fx; delete g.fy; delete g.vx; delete g.vy; }
}

function countyCounts(orgs: Org[]) {
  const m = new Map<string, number>();
  for (const o of orgs) m.set(norm(o.county), (m.get(norm(o.county)) ?? 0) + 1);
  return m;
}

/** Geographic group layout shared by bloom / choropleth / dorling. */
function groupedGeo(
  orgs: Org[], keyOf: (o: Org) => string, anchorOf: (k: string, members: Org[]) => [number, number],
  labelOf: (k: string, members: Org[]) => string, r: number, w: number, h: number,
) {
  const buckets = new Map<string, Org[]>();
  for (const o of orgs) { const k = keyOf(o); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k)!.push(o); }
  const packs = new Map<string, ReturnType<typeof packEqual>>();
  const groups: Group[] = [];
  for (const [k, members] of buckets) {
    const p = packEqual(members, r);
    packs.set(k, p);
    const [ax, ay] = anchorOf(k, members);
    groups.push({ key: k, label: labelOf(k, members), n: members.length, ax, ay, x: ax, y: ay, r: p.R });
  }
  return { groups, packs, place: () => {
    const nodes = new Map<string, NodePos>();
    for (const g of groups) {
      const p = packs.get(g.key);
      if (!p) continue;
      for (const c of p.circles) nodes.set(c.id, { x: g.x + c.dx, y: g.y + c.dy, r });
    }
    return nodes;
  } };
}

export function computeLayout(
  variant: Variant, orgs: Org[], counties: Counties, w: number, h: number, groupBy: GroupBy, labels: { other: string; bucharest: string; groupLabel: (k: string) => string },
  fit = false,
): Layout {
  const r = nodeRadius(w, h);
  const counts = countyCounts(orgs);
  const pad = Math.max(10, w * 0.03);

  if (variant === 'universe') return universe(orgs, w, h, groupBy, labels.groupLabel, counts, fit);

  if (variant === 'zoom') {
    const projection = fitProjection(counties, pad, pad, w - pad, h - pad);
    const nodes = new Map<string, NodePos>();
    for (const o of orgs) { const [x, y] = projection([o.lon, o.lat])!; nodes.set(o.id, { x, y, r }); }
    return { nodes, groups: [], projection, countyCounts: counts };
  }

  if (variant === 'bloom') {
    // Reserve room at the bottom for the Bucharest bloom.
    const bucharest = orgs.filter((o) => norm(o.uat).startsWith('bucuresti'));
    const R = packEqual(bucharest, r).R;
    const mapBottom = Math.max(h * 0.62, h - R * 1.25);
    const projection = fitProjection(counties, pad, pad, w - pad, mapBottom);
    const keyOf = (o: Org) => (norm(o.uat).startsWith('bucuresti') ? 'bucuresti' : `${o.lat.toFixed(3)},${o.lon.toFixed(3)}`);
    const real = (members: Org[]) => projection([members[0].lon, members[0].lat]) as [number, number];
    const { groups, place } = groupedGeo(orgs, keyOf, (k, m) => {
      const p = real(m);
      if (k !== 'bucuresti') return p;
      return [Math.min(w - R - 6, Math.max(R + 6, p[0] + R * 0.95)), h - R - 6];
    }, (k, m) => (k === 'bucuresti' ? labels.bucharest : m[0].uat), r, w, h);
    // keep the true Bucharest point for the leader line
    const bg = groups.find((g) => g.key === 'bucuresti');
    relax(groups, w, h, 2.5, new Set(['bucuresti']));
    if (bg) { const p = real(bucharest); bg.px = p[0]; bg.py = p[1]; }
    return { nodes: place(), groups, projection, countyCounts: counts };
  }

  // choropleth & dorling: one group per county, anchored at the county centroid
  const projection = fitProjection(counties, pad, pad, w - pad, h - pad);
  const path = geoPath(projection);
  const centroid = new Map<string, [number, number]>();
  const nameOf = new Map<string, string>();
  for (const f of counties.features) { centroid.set(norm(f.properties.name), path.centroid(f) as [number, number]); nameOf.set(norm(f.properties.name), f.properties.name); }
  const { groups, place } = groupedGeo(orgs, (o) => norm(o.county), (k) => centroid.get(k) ?? [w / 2, h / 2], (k, m) => nameOf.get(k) ?? m[0].county, r, w, h);

  if (variant === 'dorling') {
    for (const g of groups) g.r += r * 0.45; // breathing room inside the county disc
    for (const [k, c] of centroid) if (!counts.has(k)) groups.push({ key: k, label: nameOf.get(k)!, n: 0, ax: c[0], ay: c[1], x: c[0], y: c[1], r: Math.max(3, r * 0.45), empty: true });
    relax(groups, w, h, Math.max(2, r * 0.25));
    const nodes = place();
    return { nodes, groups, projection, countyCounts: counts };
  }
  relax(groups, w, h, 1.5);
  return { nodes: place(), groups, projection, countyCounts: counts };
}

let measureCtx: CanvasRenderingContext2D | null = null;
/** Number of lines a group label wraps to in the Clusters view (.ulabel: 9.5px Noto Sans, 500). */
function labelLines(text: string, width: number, indent = 0) {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  const m = (t: string) => (measureCtx ? (measureCtx.font = "500 9.5px 'Noto Sans', sans-serif", measureCtx.measureText(t).width) : t.length * 5.3);
  let lines = 1; let cur = indent;
  for (const word of text.split(' ')) {
    const ww = m(word); const sp = m(' ');
    if (cur > 0 && cur + sp + ww > width) { lines++; cur = ww; } else cur += (cur > 0 ? sp : 0) + ww;
  }
  return lines;
}

/** fit: always shrink to fit the box (export), instead of letting phones scroll */
function universe(orgs: Org[], w: number, h: number, groupBy: GroupBy, groupLabel: (k: string) => string, counts: Map<string, number>, fit = false): Layout {
  // an organisation can sit in several activity groups, so groups hold node instances (key = org id, or id@group)
  const keysOf: (o: Org) => string[] = {
    reach: (o: Org) => [o.reach],
    cluster: (o: Org) => [o.clusters.join(' + ')],
    activity: (o: Org) => (o.activities.length ? o.activities : ['~other']),
  }[groupBy];
  const buckets = new Map<string, Org[]>();
  for (const o of orgs) for (const k of keysOf(o)) { if (!buckets.has(k)) buckets.set(k, []); buckets.get(k)!.push(o); }
  const multi = groupBy === 'activity';
  // first appearance keeps the plain id so it animates from its map position; repeats get id@group
  const seen = new Set<string>();
  const instKey = (id: string, k: string) => (multi && seen.has(id) ? `${id}@${k}` : (seen.add(id), id));
  const instances: { key: string; id: string }[] = [];
  let keys = [...buckets.keys()];
  if (groupBy === 'reach') keys = REACHES.filter((k) => buckets.has(k));
  else keys.sort((a, b) => (a === '~other' ? 1 : b === '~other' ? -1 : buckets.get(b)!.length - buckets.get(a)!.length));

  // Flow layout: one packed bubble per group, laid out in centred rows like words in a paragraph,
  // with room above each bubble for its (possibly long, official) label. Scale is chosen to fit the stage.
  const nodes = new Map<string, NodePos>();
  const groups: Group[] = [];
  let contentH = h;
  // label height per group = measured wrapped lines of "<label> <n>" at the label width (+ cluster dots)
  const dots = groupBy === 'cluster' ? 30 : 0;
  const labelH = (k: string, lw: number) => labelLines(`${groupLabel(k)} ${buckets.get(k)!.length}`, lw, dots) * 11.6 + 9;
  const minCell = groupBy === 'cluster' ? 140 : 96;
  const gapX = 14; const gapY = 10;
  const base = nodeRadius(w, h);
  for (let step = 0; step <= 26; step++) {
    const s = 1.6 - step * 0.05; // 1.6 → 0.3
    // on phones keep avatars big enough to tap (≥ ~22px) and let the view scroll instead of shrinking further
    const phone = !fit && w < 560;
    const PHONE_R = 11;
    const last = step === 26 || (phone && base * s <= PHONE_R);
    const r = phone ? Math.max(base * s, PHONE_R) : base * s;
    const items = keys.map((k) => { const p = packEqual(buckets.get(k)!, r, 0.9); return { k, p, cw: Math.max(p.R * 2, minCell) }; });
    const rows: { items: typeof items; width: number; height: number }[] = [];
    let cur: typeof items = []; let cw = 0;
    for (const it of items) {
      if (cur.length && cw + gapX + it.cw > w - 8) { rows.push({ items: cur, width: cw, height: 0 }); cur = []; cw = 0; }
      cw += (cur.length ? gapX : 0) + it.cw; cur.push(it);
    }
    if (cur.length) rows.push({ items: cur, width: cw, height: 0 });
    const rowLabelH = (row: (typeof rows)[number]) => Math.max(...row.items.map((i) => labelH(i.k, i.cw - 6)));
    for (const row of rows) row.height = rowLabelH(row) + Math.max(...row.items.map((i) => i.p.R * 2));
    const H = rows.reduce((a, r2) => a + r2.height, 0) + gapY * (rows.length - 1);
    if (H > h - 8 && !last) continue;
    contentH = Math.max(h, H + 8);
    let y = Math.max(4, (h - H) / 2);
    for (const row of rows) {
      let x = (w - row.width) / 2;
      const maxD = Math.max(...row.items.map((i) => i.p.R * 2));
      const lh = rowLabelH(row);
      for (const it of row.items) {
        const cx = x + it.cw / 2; const cy = y + lh + maxD / 2;
        groups.push({ key: it.k, label: groupLabel(it.k), n: buckets.get(it.k)!.length, x: cx, y: cy, r: it.p.R, ax: 0, ay: 0, lw: it.cw - 6 });
        for (const c of it.p.circles) { const ik = instKey(c.id, it.k); nodes.set(ik, { x: cx + c.dx, y: cy + c.dy, r }); instances.push({ key: ik, id: c.id }); }
        x += it.cw + gapX;
      }
      y += row.height + gapY;
    }
    break;
  }
  return { nodes, groups, projection: null, countyCounts: counts, contentH, instances };
}

/** Collision-resolved positions for the zoomable map at zoom level k (in map coordinates). */
export function zoomSpread(orgs: Org[], projection: GeoProjection, k: number, rScreen: number) {
  type N = { id: string; x: number; y: number; ax: number; ay: number };
  const nodes: N[] = orgs.map((o) => { const [x, y] = projection([o.lon, o.lat])!; return { id: o.id, x, y, ax: x, ay: y }; });
  // deterministic tiny jitter so co-located points can separate
  nodes.forEach((n, i) => { n.x += Math.cos(i * 2.4) * 0.01; n.y += Math.sin(i * 2.4) * 0.01; });
  const rr = (rScreen + 0.8) / k;
  const sim = forceSimulation(nodes)
    .force('x', forceX<N>((d) => d.ax).strength(0.08))
    .force('y', forceY<N>((d) => d.ay).strength(0.08))
    .force('c', forceCollide<N>(rr).strength(1).iterations(3))
    .stop();
  for (let i = 0; i < 180; i++) sim.tick();
  return new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
}
