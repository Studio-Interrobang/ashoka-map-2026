<script lang="ts">
  import { ui, matches, toggle } from '../lib/state.svelte';
  import { CLUSTERS, type Org } from '../lib/types';
  import type { Dict } from '../lib/i18n';

  let { orgs, t }: { orgs: Org[]; t: Dict } = $props();

  let shown = $derived(orgs.filter((o) => matches(o, ui.lens)));
  let nCounties = $derived(new Set(shown.map((o) => o.county)).size);
  let mix = $derived(CLUSTERS.map((c) => ({ c, n: shown.filter((o) => o.clusters.includes(c)).length })));
  let anySel = $derived(ui.lens.clusters.length > 0);
  // AA-contrast text tones of the four cluster colours
  const tone = { C1: '#003F72', C2: '#00639a', C3: '#006b59', C4: '#9a5600' } as const;
</script>

<section class="band" aria-label="Summary">
  <div class="total">
    <span class="num">{shown.length}</span>
    <span class="lbl">
      {shown.length === orgs.length ? '' : `${t.of} ${orgs.length} `}{t.organisations}{" "}<br />{t.inCounties.replace('{n}', String(nCounties))}
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

<style>
  /* 600–999px: total cell + 2×2 cluster grid, ~70px tall */
  .band {
    display: grid; grid-template-columns: 150px minmax(0, 1fr); align-items: center; gap: 10px;
    background: #F3F4F6; border-radius: var(--radius); padding: 6px 8px; min-width: 0;
  }
  .total { display: flex; align-items: center; gap: 7px; padding-right: 10px; border-right: 1px solid #DDE0E4; }
  .num { font-size: 30px; font-weight: 800; color: var(--cyan-text); line-height: 1; font-variant-numeric: tabular-nums; }
  .num.sm { font-size: 18px; min-width: 2ch; }
  .lbl { font-size: 11.5px; font-weight: 700; line-height: 1.25; color: var(--ink); }
  .clusters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 6px; min-width: 0; }
  .cl {
    display: flex; align-items: center; gap: 6px; min-width: 0; min-height: 28px; text-align: left; font: inherit; cursor: pointer;
    background: transparent; border: 1px solid transparent; border-radius: var(--radius); padding: 1px 5px; transition: opacity 0.2s, background 0.2s;
  }
  .cl:hover { background: #fff; border-color: #E1E4E8; }
  .cl.on { background: #fff; border-color: var(--navy); }
  .cl.off { opacity: 0.45; }
  .cl img { flex: none; width: 22px; height: 22px; }
  .name { font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.02em; line-height: 11.5px; color: var(--ink); min-width: 0; }

  /* ≥1000px: one row */
  @container (min-width: 1000px) {
    .band { grid-template-columns: 148px minmax(0, 1fr); padding: 8px 10px; }
    .clusters { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .num { font-size: 34px; }
    .num.sm { font-size: 24px; }
    .cl img { width: 32px; height: 32px; }
    .cl { min-height: 40px; }
    .name { font-size: 10px; line-height: 12px; }
  }
  /* phones: one-line total above the 2×2 grid */
  @container (max-width: 599px) {
    .band { grid-template-columns: 1fr; gap: 4px; padding: 6px; }
    .total { border-right: none; padding-right: 0; }
    .num { font-size: 22px; }
    .lbl br { display: none; }
    .lbl { font-size: 11px; }
    .num.sm { font-size: 16px; }
    .cl img { width: 20px; height: 20px; }
    .name { font-size: 8.5px; line-height: 10px; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  }
</style>
