<script lang="ts">
  import { ui, matches, toggle } from '../lib/state.svelte';
  import { CLUSTERS, type Org } from '../lib/types';
  import type { Dict } from '../lib/i18n';

  let { orgs, t }: { orgs: Org[]; t: Dict } = $props();

  let shown = $derived(orgs.filter((o) => matches(o, ui.lens)));
  let nCounties = $derived(new Set(shown.map((o) => o.county)).size);
  let mix = $derived(CLUSTERS.map((c) => ({ c, n: shown.filter((o) => o.clusters.includes(c)).length })));
  let anySel = $derived(ui.lens.clusters.length > 0);
  let fact = $derived(
    ui.lens.county ? t.facts.county
    : ui.lens.activities.length ? t.facts.activities
    : ui.lens.reach.length ? t.facts.reach
    : ui.lens.clusters.length ? t.facts.clusters
    : t.facts.default,
  );
  // AA-contrast text tones of the four cluster colours
  const tone = { C1: '#003F72', C2: '#00639a', C3: '#006b59', C4: '#9a5600' } as const;
</script>

<section class="band" aria-label="Summary">
  <div class="total">
    <span class="num">{shown.length}</span>
    <span class="lbl">
      {shown.length === orgs.length ? '' : `${t.of} ${orgs.length} `}{t.organisations}<br />{t.inCounties.replace('{n}', String(nCounties))}
    </span>
  </div>
  <div class="clusters" role="group" aria-label={t.lens.clusters}>
    {#each mix as m}
      <button
        class="cl"
        class:on={ui.lens.clusters.includes(m.c)}
        class:off={anySel && !ui.lens.clusters.includes(m.c)}
        aria-pressed={ui.lens.clusters.includes(m.c)}
        onclick={() => toggle(ui.lens.clusters, m.c)}
      >
        <img src="./avatars/icon-{m.c}.webp" alt="" width="40" height="40" />
        <span class="num sm" style="color:{tone[m.c]}">{m.n}</span>
        <span class="name">{t.cluster[m.c]}</span>
      </button>
    {/each}
  </div>
</section>
<p class="fact">{fact}</p>

<style>
  .band {
    display: flex; align-items: center; gap: 8px 18px; background: #F3F4F6; border-radius: var(--radius);
    padding: 10px 14px; min-width: 0;
  }
  .total { display: flex; align-items: center; gap: 8px; flex: none; padding-right: 16px; border-right: 1px solid #DDE0E4; }
  .num { font-size: 40px; font-weight: 800; color: var(--cyan-text); line-height: 1; font-variant-numeric: tabular-nums; }
  .num.sm { font-size: 28px; min-width: 2ch; }
  .lbl { font-size: 12.5px; font-weight: 700; line-height: 1.25; color: var(--ink); }
  .clusters { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; flex: 1; min-width: 0; }
  .cl {
    display: flex; align-items: center; gap: 7px; min-width: 0; text-align: left; font: inherit; cursor: pointer;
    background: transparent; border: 1px solid transparent; border-radius: var(--radius); padding: 4px 6px; transition: opacity 0.2s, background 0.2s;
  }
  .cl:hover { background: #fff; border-color: #E1E4E8; }
  .cl.on { background: #fff; border-color: var(--navy); }
  .cl.off { opacity: 0.45; }
  .cl img { flex: none; width: 40px; height: 40px; }
  .name { font-size: 10px; text-transform: uppercase; letter-spacing: 0.02em; line-height: 1.25; color: var(--ink); }
  .fact { margin: -4px 0 0; font-size: 12px; color: #4a5560; border-left: 3px solid var(--cyan); padding-left: 10px; }

  @media (max-width: 900px) {
    .band { flex-direction: column; align-items: stretch; }
    .total { border-right: none; padding-right: 0; }
    .clusters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 560px) {
    .band { padding: 8px; gap: 6px; }
    .num { font-size: 26px; }
    .num.sm { font-size: 20px; }
    .cl img { width: 28px; height: 28px; }
    .name { font-size: 8.5px; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .cl { padding: 2px 4px; gap: 5px; }
    .lbl { font-size: 11.5px; }
    .fact { display: none; }
  }
</style>
