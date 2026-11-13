<script lang="ts">
  import { untrack } from 'svelte';
  import { geoPath } from 'd3-geo';
  import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
  import { select } from 'd3-selection';
  import 'd3-transition';
  import Avatar from './Avatar.svelte';
  import { computeLayout, zoomSpread, nodeRadius, type NodePos } from '../lib/layouts';
  import { norm, type Counties } from '../lib/data';
  import { ui, matches, lensActive } from '../lib/state.svelte';
  import type { Org } from '../lib/types';
  import type { Dict } from '../lib/i18n';

  let { orgs, counties, w, h, t }: { orgs: Org[]; counties: Counties; w: number; h: number; t: Dict } = $props();

  const groupLabel = (k: string) => {
    if (k === '~other') return t.other;
    if (ui.groupBy === 'reach') return t.reach[k as keyof typeof t.reach] ?? k;
    if (ui.groupBy === 'cluster') return k.split(' + ').map((c) => t.clusterShort[c as keyof typeof t.clusterShort]).join(' + ');
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
        sel.property('__zoom', zoomIdentity);
        zt = { k: 1, x: 0, y: 0 };
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

  function pos(o: Org): NodePos | undefined {
    if (ui.variant === 'zoom') {
      const s = spread.get(o.id) ?? layout?.nodes.get(o.id);
      return s ? { x: zt.x + zt.k * s.x, y: zt.y + zt.k * s.y, r: rz } : undefined;
    }
    return layout?.nodes.get(o.id);
  }

  let active = $derived(lensActive(ui.lens));
  let hoveredOrg = $derived(orgs.find((o) => o.id === ui.hovered));
  let hoveredPos = $derived(hoveredOrg ? pos(hoveredOrg) : undefined);

  function fill(name: string) {
    if (ui.variant !== 'choropleth') return '#EEEBE2';
    const n = layout?.countyCounts.get(norm(name)) ?? 0;
    if (!n) return '#F4F2EC';
    const tt = Math.sqrt(n / maxCount);
    // light blue ramp in the Ashoka family
    const lerp = (a: number, b: number) => Math.round(a + (b - a) * (0.25 + 0.75 * tt));
    return `rgb(${lerp(214, 0)},${lerp(230, 136)},${lerp(240, 206)})`;
  }

  function onKey(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.selected = id; }
  }
</script>

<div class="stage" class:zoomable={ui.variant === 'zoom'}>
  <svg bind:this={svgEl} width={w} height={h} role="img" aria-label="Map of organisations">
    {#if layout}
      <!-- background -->
      {#if path && ui.variant !== 'universe'}
        <g transform={ui.variant === 'zoom' ? `translate(${zt.x},${zt.y}) scale(${zt.k})` : ''} class="counties" class:faint={ui.variant === 'dorling'}>
          {#each counties.features as f (f.properties.name)}
            <path d={path(f)} fill={ui.variant === 'dorling' ? '#F6F4EF' : fill(f.properties.name)} vector-effect="non-scaling-stroke">
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
        {#each orgs as o (o.id)}
          {@const p = pos(o)}
          {#if p}
            <g
              class="node"
              class:dim={active && !matches(o, ui.lens)}
              class:selected={ui.selected === o.id}
              style="transform: translate({p.x}px, {p.y}px)"
              role="button"
              tabindex="0"
              aria-label={o.short}
              onmouseenter={() => (ui.hovered = o.id)}
              onmouseleave={() => (ui.hovered = null)}
              onfocus={() => (ui.hovered = o.id)}
              onblur={() => (ui.hovered = null)}
              onclick={() => (ui.selected = o.id)}
              onkeydown={(e) => onKey(e, o.id)}
            >
              <Avatar org={o} r={p.r} detailed={ui.textured || p.r >= 22} />
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
          {:else if ui.variant === 'universe'}
            <text x={g.x} y={g.y - g.r - 6} text-anchor="middle" class="glabel">{g.label} · {g.n}</text>
          {/if}
        {/each}
      </g>
    {/if}
  </svg>

  {#if hoveredOrg && hoveredPos}
    <div class="tip" style="left:{hoveredPos.x}px; top:{hoveredPos.y - hoveredPos.r - 8}px">
      <strong>{hoveredOrg.short}</strong><span>{hoveredOrg.uat}</span>
    </div>
  {/if}

  {#if ui.variant === 'zoom'}
    <div class="zoom-ctl">
      <button onclick={() => zoomBy(1.8)} aria-label="Zoom in">+</button>
      <button onclick={() => zoomBy(1 / 1.8)} aria-label="Zoom out">−</button>
    </div>
    <div class="hint">{t.zoomHint}</div>
  {/if}
</div>

<style>
  .stage { position: relative; width: 100%; height: 100%; overflow: hidden; }
  .stage.zoomable svg { cursor: grab; }
  svg { display: block; touch-action: none; }
  .counties path { stroke: #fff; stroke-width: 1; transition: fill 0.4s; }
  .counties.faint path { stroke: #E6E2D8; }
  .nodes.animate .node { transition: transform 0.75s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s; }
  .node { cursor: pointer; outline: none; }
  .node.dim { opacity: 0.13; }
  .node:focus-visible :global(.hit) { stroke: var(--navy); stroke-width: 2; }
  .sel-ring { fill: none; stroke: var(--navy); stroke-width: 2.2; }
  .leader { stroke: var(--navy); stroke-width: 1.2; stroke-dasharray: 3 3; }
  .leader-dot { fill: var(--navy); }
  .bloom-bg { fill: #F6F4EF; stroke: #E6E2D8; }
  .county-disc { fill: #F1EEE6; stroke: #DAD7CB; }
  .county-disc.empty { fill: #E6E2D8; stroke: none; }
  .uni-group { fill: rgba(0, 63, 114, 0.04); stroke: rgba(0, 63, 114, 0.15); }
  .glabel { font-size: 11px; font-weight: 600; fill: var(--ink); paint-order: stroke; stroke: #fff; stroke-width: 3px; pointer-events: none; }
  .glabel.big { font-size: 14px; font-weight: 700; fill: var(--navy); }
  .gcount { font-size: 26px; font-weight: 800; fill: var(--cyan-text); paint-order: stroke; stroke: #fff; stroke-width: 3px; }
  .tip {
    position: absolute; transform: translate(-50%, -100%); pointer-events: none;
    background: var(--navy); color: #fff; padding: 5px 9px; border-radius: var(--radius-sm); font-size: 12px;
    white-space: nowrap; display: flex; flex-direction: column; line-height: 1.25; box-shadow: 0 4px 14px rgba(0,0,0,.2);
  }
  .tip span { opacity: 0.75; font-size: 11px; }
  .zoom-ctl { position: absolute; right: 10px; top: 10px; display: flex; flex-direction: column; gap: 4px; }
  .zoom-ctl button { width: 30px; height: 30px; border-radius: var(--radius); border: 1px solid var(--line); background: #fff; font-size: 18px; color: var(--navy); cursor: pointer; }
  .hint { position: absolute; left: 12px; bottom: 8px; font-size: 11px; color: #6b6b6b; }
</style>
