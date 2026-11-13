<script lang="ts">
  import { untrack, tick } from 'svelte';
  import { geoPath } from 'd3-geo';
  import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
  import { select } from 'd3-selection';
  import 'd3-transition';
  import Avatar from './Avatar.svelte';
  import { computeLayout, zoomSpread, nodeRadius, type NodePos } from '../lib/layouts';
  import { norm, type Counties } from '../lib/data';
  import { ui, matches, lensActive } from '../lib/state.svelte';
  import { CLUSTER_COLORS, type Cluster, type Org } from '../lib/types';
  import type { Dict } from '../lib/i18n';

  let { orgs, counties, w, h, t }: { orgs: Org[]; counties: Counties; w: number; h: number; t: Dict } = $props();

  const groupLabel = (k: string) => {
    if (k === '~other') return ui.groupBy === 'activity' ? t.notSpecified : t.other;
    if (ui.groupBy === 'reach') return t.reach[k as keyof typeof t.reach] ?? k;
    if (ui.groupBy === 'cluster') return k.split(' + ').map((c) => t.cluster[c as keyof typeof t.cluster]).join(' + ');
    if (ui.groupBy === 'activity') return t.activity[k as keyof typeof t.activity] ?? k;
    return k;
  };

  let layout = $derived(
    w > 0 && h > 0
      ? computeLayout(ui.variant, orgs, counties, w, h, ui.groupBy, { other: t.other, bucharest: t.bucharest, groupLabel })
      : null,
  );
  let path = $derived(layout?.projection ? geoPath(layout.projection) : null);
  let maxCount = $derived(layout ? Math.max(...layout.countyCounts.values()) : 1);

  // ---- zoomable variant ----
  let zt = $state({ k: 1, x: 0, y: 0 });
  let zooming = $state(false);
  // skip the fly-in on first paint (avoids nodes animating from a pre-measurement layout)
  let ready = $state(false);
  $effect(() => { if (layout && !ready) setTimeout(() => (ready = true), 400); });
  let spread = $state(new Map<string, { x: number; y: number }>());
  let svgEl: SVGSVGElement | undefined = $state();
  let stageEl: HTMLDivElement | undefined = $state();
  /** for export: the chart svg + the element holding its HTML labels */
  export function chartEls() { return { svg: svgEl!, overlay: stageEl ?? null }; }
  /** Run fn with the whole map in view (no zoom), then put the user's zoom back. Used by the social export. */
  export async function withFullView<T>(fn: () => Promise<T>): Promise<T> {
    if (!svgEl || !zb) return fn();
    const sel = select(svgEl);
    const prev = zoomIdentity.translate(zt.x, zt.y).scale(zt.k);
    sel.interrupt().call(zb.transform, zoomIdentity);
    await tick();
    try { return await fn(); } finally { sel.call(zb.transform, prev); }
  }
  let zb: ZoomBehavior<SVGSVGElement, unknown> | null = null;
  let rz = $derived(Math.min(nodeRadius(w, h) * Math.sqrt(zt.k) * 0.8, 20));

  function respread() {
    if (layout?.projection) spread = zoomSpread(orgs, layout.projection, zt.k, rz);
  }

  $effect(() => {
    // dependencies: element, variant, layout (size/projection). Everything else untracked to avoid loops.
    const el = svgEl;
    const variant = ui.variant;
    const proj = layout?.projection;
    const W = w, H = h;
    if (!el) return;
    return untrack(() => {
      const sel = select(el);
      if (variant === 'zoom' && proj) {
        zb = d3zoom<SVGSVGElement, unknown>()
          .scaleExtent([1, 14])
          .translateExtent([[0, 0], [W, H]])
          .on('start', () => (zooming = true))
          .on('zoom', (e) => (zt = { k: e.transform.k, x: e.transform.x, y: e.transform.y }))
          .on('end', () => { zooming = false; respread(); });
        sel.call(zb).on('dblclick.zoom', null);
        const it = homeTransform(W, H);
        sel.property('__zoom', it);
        zt = { k: it.k, x: it.x, y: it.y };
        respread();
      } else {
        sel.on('.zoom', null);
        zb = null;
        zt = { k: 1, x: 0, y: 0 };
      }
      return () => { sel.on('.zoom', null); };
    });
  });

  function zoomBy(f: number) { if (svgEl && zb) select(svgEl).transition().duration(350).call(zb.scaleBy, f); }
  /** Start view. Phones: Romania is wider than the stage is tall, so start zoomed in to fill the height (pan to see the edges). */
  function homeTransform(W: number, H: number) {
    if (W >= 600 || !path) return zoomIdentity;
    const [[x0, y0], [x1, y1]] = path.bounds(counties as never);
    const k = Math.min(1.45, Math.max(1, (H * 0.94) / (y1 - y0)));
    const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
    const tx = Math.min(0, Math.max(W - W * k, W / 2 - cx * k));
    const ty = Math.min(0, Math.max(H - H * k, H / 2 - cy * k));
    return zoomIdentity.translate(tx, ty).scale(k);
  }
  let home = $derived(homeTransform(w, h));
  function resetZoom() { if (svgEl && zb) select(svgEl).transition().duration(450).call(zb.transform, home); }
  let zoomed = $derived(Math.abs(zt.k - home.k) > 0.01 || Math.abs(zt.x - home.x) > 1 || Math.abs(zt.y - home.y) > 1);

  // node instances: one per org, except the Clusters view grouped by activity (an org can appear in several groups)
  let byId = $derived(new Map(orgs.map((o) => [o.id, o])));
  let items = $derived(
    ui.variant === 'universe' && layout?.instances
      ? layout.instances.map((i) => ({ key: i.key, o: byId.get(i.id)! }))
      : orgs.map((o) => ({ key: o.id, o })),
  );
  let hoverKey = $state<string | null>(null);

  function pos(key: string): NodePos | undefined {
    if (ui.variant === 'zoom') {
      const s = spread.get(key) ?? layout?.nodes.get(key);
      return s ? { x: zt.x + zt.k * s.x, y: zt.y + zt.k * s.y, r: rz } : undefined;
    }
    return layout?.nodes.get(key);
  }

  let active = $derived(lensActive(ui.lens));
  let hoveredOrg = $derived(orgs.find((o) => o.id === ui.hovered));
  let hoveredPos = $derived(hoverKey && hoveredOrg ? pos(hoverKey) : undefined);

  function fill(name: string) {
    // zoomable map: counties with organisations a touch darker than empty ones
    if (ui.variant === 'zoom') return (layout?.countyCounts.get(norm(name)) ?? 0) > 0 ? '#E4E7EB' : '#F4F5F7';
    if (ui.variant !== 'choropleth') return '#ECEEF1';
    const n = layout?.countyCounts.get(norm(name)) ?? 0;
    if (!n) return '#F6F7F8';
    const tt = Math.sqrt(n / maxCount);
    // light blue ramp in the Ashoka family
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * (0.25 + 0.75 * tt));
    return `rgb(${lerp(214, 0)},${lerp(230, 136)},${lerp(240, 206)})`;
  }

  function onKey(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.selected = id; }
  }
</script>

<div class="stage" bind:this={stageEl} class:zoomable={ui.variant === 'zoom'} class:scroll={ui.variant === 'universe'}>
  <svg bind:this={svgEl} width={w} height={layout?.contentH ?? h} role="img" aria-label="Map of organisations">
    {#if layout}
      <!-- background -->
      {#if path && ui.variant !== 'universe'}
        <g transform={ui.variant === 'zoom' ? `translate(${zt.x},${zt.y}) scale(${zt.k})` : ''} class="counties" class:faint={ui.variant === 'dorling'}>
          {#each counties.features as f (f.properties.name)}
            <path d={path(f)} fill={ui.variant === 'dorling' ? '#F5F6F8' : fill(f.properties.name)} vector-effect="non-scaling-stroke">
              <title>{f.properties.name} · {layout.countyCounts.get(norm(f.properties.name)) ?? 0}</title>
            </path>
          {/each}
        </g>
      {/if}

      <g class="groups">
        {#each layout.groups as g (g.key)}
          {#if ui.variant === 'bloom'}
            {#if g.key === 'bucuresti' && g.px != null && g.py != null}
              {@const dx = g.x - g.px}
              {@const dy = g.y - g.py}
              {@const d = Math.hypot(dx, dy) || 1}
              <line x1={g.px} y1={g.py} x2={g.x - (dx / d) * (g.r + 6)} y2={g.y - (dy / d) * (g.r + 6)} class="leader" />
              <circle cx={g.px} cy={g.py} r="3.5" class="leader-dot" />
              <circle cx={g.x} cy={g.y} r={g.r + 6} class="bloom-bg" />
            {/if}
          {:else if ui.variant === 'dorling'}
            <circle cx={g.x} cy={g.y} r={g.r} class="county-disc" class:empty={g.empty}><title>{g.label} · {g.n}</title></circle>
          {:else if ui.variant === 'universe'}
            <circle cx={g.x} cy={g.y} r={g.r} class="uni-group" />
          {/if}
        {/each}
      </g>

      <!-- organisations -->
      <g class="nodes" class:animate={ready && !zooming}>
        {#each items as { key, o } (key)}
          {@const p = pos(key)}
          {#if p}
            <g
              class="node"
              class:dim={active && !matches(o, ui.lens)}
              class:selected={ui.selected === o.id}
              style="transform: translate({p.x}px, {p.y}px)"
              role="button"
              tabindex="0"
              aria-label={o.short}
              onmouseenter={() => { ui.hovered = o.id; hoverKey = key; }}
              onmouseleave={() => { ui.hovered = null; hoverKey = null; }}
              onfocus={() => { ui.hovered = o.id; hoverKey = key; }}
              onblur={() => { ui.hovered = null; hoverKey = null; }}
              onclick={() => (ui.selected = o.id)}
              onkeydown={(e) => onKey(e, o.id)}
            >
              <Avatar org={o} r={p.r} detailed={false} />
              {#if ui.selected === o.id}<circle r={p.r + 3} class="sel-ring" />{/if}
            </g>
          {/if}
        {/each}
      </g>
      <g class="labels">
        {#each layout.groups as g (g.key)}
          {#if ui.variant === 'bloom'}
            {#if g.key === 'bucuresti'}
              <text x={g.x - g.r - 12} y={g.y - g.r * 0.35} text-anchor="end" class="glabel big">{g.label}</text>
              <text x={g.x - g.r - 12} y={g.y - g.r * 0.35 + 26} text-anchor="end" class="gcount">{g.n}</text>
            {:else if g.n >= 4}
              <text x={g.x} y={g.y + g.r + 12} text-anchor="middle" class="glabel">{g.label} · {g.n}</text>
            {/if}
          {:else if ui.variant === 'dorling' && !g.empty && g.r > 14}
            <text x={g.x} y={g.y + g.r + 11 > h - 3 ? g.y - g.r - 5 : g.y + g.r + 11} text-anchor="middle" class="glabel">{g.label}{g.n > 1 ? ` · ${g.n}` : ''}</text>
          {:else if ui.variant === 'choropleth' && g.n >= 3}
            <text x={g.x} y={g.y + g.r + 11} text-anchor="middle" class="glabel">{g.label} · {g.n}</text>
          {/if}
        {/each}
      </g>
    {/if}
  </svg>

  {#if layout && ui.variant === 'universe'}
    {#each layout.groups as g (g.key)}
      <div class="ulabel" style="left:{g.x}px; top:{g.y - g.r - 5}px; width:{g.lw ?? 130}px">
        {#if ui.groupBy === 'cluster'}<span class="udots">{#each g.key.split(' + ') as c}<i style="background:{CLUSTER_COLORS[c as Cluster]}"></i>{/each}</span>{/if}{g.label} <b>{g.n}</b>
      </div>
    {/each}
  {/if}

  {#if hoveredOrg && hoveredPos}
    <div class="tip" style="left:{hoveredPos.x}px; top:{hoveredPos.y - hoveredPos.r - 8}px">
      <strong>{hoveredOrg.short}</strong><span>{hoveredOrg.uat}</span>
    </div>
  {/if}

  {#if ui.variant === 'zoom'}
    <div class="zoom-ctl">
      <button onclick={() => zoomBy(1.8)} aria-label={t.zoomIn} title={t.zoomIn}>+</button>
      <button onclick={() => zoomBy(1 / 1.8)} aria-label={t.zoomOut} title={t.zoomOut}>−</button>
      {#if zoomed}<button class="reset" onclick={resetZoom} aria-label={t.reset} title={t.reset}>⟲</button>{/if}
    </div>
    <div class="hint">{t.zoomHint}</div>
  {/if}
</div>

<style>
  .stage { position: relative; width: 100%; height: 100%; overflow: hidden; }
  .stage.scroll { overflow-y: auto; overflow-x: hidden; }
  .stage.zoomable svg { cursor: grab; }
  svg { display: block; touch-action: none; }
  .counties path { stroke: #fff; stroke-width: 1; transition: fill 0.4s; }
  .counties.faint path { stroke: #E1E4E8; }
  .nodes.animate .node { transition: transform 0.75s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s; }
  .node { cursor: pointer; outline: none; }
  .node.dim { opacity: 0.13; }
  .node:focus-visible :global(.hit) { stroke: var(--navy); stroke-width: 2; }
  .sel-ring { fill: none; stroke: var(--navy); stroke-width: 2.2; }
  .leader { stroke: var(--navy); stroke-width: 1; }
  .leader-dot { fill: var(--navy); }
  .bloom-bg { fill: #F5F6F8; stroke: #E1E4E8; }
  .county-disc { fill: #F1F2F4; stroke: #D5D9DE; }
  .county-disc.empty { fill: #E1E4E8; stroke: none; }
  .uni-group { fill: #F3F4F6; stroke: #E1E4E8; }
  .glabel { font-size: 11px; font-weight: 600; fill: var(--ink); paint-order: stroke; stroke: #fff; stroke-width: 3px; pointer-events: none; }
  .glabel.big { font-size: 14px; font-weight: 700; fill: var(--navy); }
  .gcount { font-size: 26px; font-weight: 800; fill: var(--cyan-text); paint-order: stroke; stroke: #fff; stroke-width: 3px; }
  .ulabel { position: absolute; transform: translate(-50%, -100%); text-align: center; font-size: 9.5px; line-height: 1.2; font-weight: 500; color: #4a5560; pointer-events: none; }
  .ulabel b { color: var(--navy); font-weight: 800; font-size: 10.5px; }
  .udots { display: inline-flex; gap: 2px; margin-right: 4px; vertical-align: 0; }
  .udots i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
  .tip {
    position: absolute; transform: translate(-50%, -100%); pointer-events: none;
    background: var(--navy); color: #fff; padding: 5px 9px; border-radius: var(--radius-sm); font-size: 12px;
    white-space: nowrap; display: flex; flex-direction: column; line-height: 1.25; box-shadow: 0 4px 14px rgba(0,0,0,.2);
  }
  .tip span { opacity: 0.75; font-size: 11px; }
  .zoom-ctl { position: absolute; right: 10px; top: 10px; display: flex; flex-direction: column; gap: 4px; }
  .zoom-ctl button { width: 30px; height: 30px; border-radius: var(--radius); border: 1px solid var(--line); background: #fff; font-size: 18px; line-height: 1; color: var(--navy); cursor: pointer; padding: 0; }
  .zoom-ctl button:hover { background: #F3F4F6; }
  .zoom-ctl .reset { font-size: 16px; }
  .hint { position: absolute; left: 12px; bottom: 8px; font-size: 11px; color: #6b6b6b; }
</style>
