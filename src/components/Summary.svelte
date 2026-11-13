<script lang="ts">
  import { avatarUrl } from '../lib/data';
  import { ui, matches } from '../lib/state.svelte';
  import { CLUSTERS, CLUSTER_COLORS, type Org } from '../lib/types';
  import type { Dict } from '../lib/i18n';

  let { orgs, t, vertical = false }: { orgs: Org[]; t: Dict; vertical?: boolean } = $props();

  let shown = $derived(orgs.filter((o) => matches(o, ui.lens)));
  let nCounties = $derived(new Set(shown.map((o) => o.county)).size);
  let mix = $derived(CLUSTERS.map((c) => ({ c, n: shown.filter((o) => o.clusters.includes(c)).length })));
  let mixTotal = $derived(mix.reduce((s, m) => s + m.n, 0) || 1);
  let fact = $derived(
    ui.lens.county ? t.facts.county
    : ui.lens.activities.length ? t.facts.activities
    : ui.lens.reach.length ? t.facts.reach
    : ui.lens.clusters.length ? t.facts.clusters
    : t.facts.default,
  );
  // No single-C3 badge exists; C1C3 has C3 on its right half.
  const icon: Record<string, [string, string]> = { C1: ['C1_National', 'none'], C2: ['C2_National', 'none'], C3: ['C1C3_National', 'inset(0 0 0 50%)'], C4: ['C4_National', 'none'] };
</script>

{#if vertical}
  <div class="v">
    <div class="big"><span class="num">{shown.length}</span><span class="lbl">{shown.length === orgs.length ? '' : `${t.of} ${orgs.length} `}{t.organisations}<br />{t.inCounties.replace('{n}', String(nCounties))}</span></div>
    {#each mix as m}
      <div class="row">
        <img src={avatarUrl(icon[m.c][0])} alt="" width="38" height="38" style="clip-path: {icon[m.c][1]}" />
        <span class="num sm" style="color:{m.c === 'C1' ? '#003F72' : m.c === 'C3' ? '#006b59' : m.c === 'C4' ? '#9a5600' : '#00639a'}">{m.n}</span>
        <span class="lbl up">{t.cluster[m.c]}</span>
      </div>
    {/each}
    <p class="fact">{fact}</p>
  </div>
{:else}
  <div class="h">
    <div class="count"><strong>{shown.length}</strong> {shown.length === orgs.length ? '' : `${t.of} ${orgs.length} `}{t.organisations} · {t.inCounties.replace('{n}', String(nCounties))}</div>
    <div class="bar" aria-hidden="true">
      {#each mix as m}<span style="flex:{m.n / mixTotal}; background:{CLUSTER_COLORS[m.c]}" title="{t.cluster[m.c]}: {m.n}"></span>{/each}
    </div>
    <p class="fact">{fact}</p>
  </div>
{/if}

<style>
  .v { display: flex; flex-direction: column; gap: 14px; }
  .big { display: flex; align-items: center; gap: 10px; }
  .num { font-size: 46px; font-weight: 800; color: var(--cyan-text); line-height: 1; font-variant-numeric: tabular-nums; }
  .num.sm { font-size: 30px; min-width: 44px; }
  .lbl { font-size: 12.5px; font-weight: 700; line-height: 1.25; }
  .lbl.up { font-size: 10.5px; font-weight: 400; text-transform: uppercase; letter-spacing: 0.02em; }
  .row { display: flex; align-items: center; gap: 6px; }
  .fact { font-size: 12.5px; line-height: 1.4; color: #444; margin: 0; border-left: 3px solid var(--cyan); padding-left: 10px; }
  .h { display: grid; min-width: 0; grid-template-columns: auto minmax(0, 1fr); gap: 6px 14px; align-items: center; }
  .count { font-size: 13px; white-space: nowrap; }
  .count strong { font-size: 18px; color: var(--navy); }
  .bar { display: flex; height: 8px; border-radius: var(--radius-sm); overflow: hidden; gap: 2px; }
  .bar span { transition: flex 0.4s; }
  .h .fact { grid-column: 1 / -1; font-size: 12px; }
  @media (max-width: 560px) { .h { grid-template-columns: 1fr; } }
</style>
