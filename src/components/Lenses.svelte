<script lang="ts">
  import { ui, toggle, clearLens, lensActive } from '../lib/state.svelte';
  import { CLUSTERS, REACHES, ACTIVITIES, CLUSTER_COLORS, type Org } from '../lib/types';
  import type { Dict } from '../lib/i18n';

  let { orgs, t }: { orgs: Org[]; t: Dict } = $props();
  type Key = 'clusters' | 'reach' | 'activities' | 'county';
  let open = $state<Key | null>(null);

  let counties = $derived(
    [...new Set(orgs.map((o) => o.county))].sort((a, b) => a.localeCompare(b, 'ro')).map((c) => ({ c, n: orgs.filter((o) => o.county === c).length })),
  );
  const count = (f: (o: Org) => boolean) => orgs.filter(f).length;
  const n = (k: Key) => (k === 'county' ? (ui.lens.county ? 1 : 0) : ui.lens[k].length);

  function onWindowClick(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest('.lens')) open = null;
  }
</script>

<svelte:window onclick={onWindowClick} onkeydown={(e) => e.key === 'Escape' && (open = null)} />

<div class="bar">
  <!-- cluster chips always visible: primary lens -->
  <div class="chips" role="group" aria-label={t.lens.clusters}>
    {#each CLUSTERS as c}
      <button class="chip" class:on={ui.lens.clusters.includes(c)} aria-pressed={ui.lens.clusters.includes(c)} onclick={() => toggle(ui.lens.clusters, c)} title={t.cluster[c]}>
        <span class="dot" style="background:{CLUSTER_COLORS[c]}"></span>{t.cluster[c]}
        <span class="n">{count((o) => o.clusters.includes(c))}</span>
      </button>
    {/each}
  </div>

  <div class="more">
    {#each ['reach', 'activities', 'county'] as const as k}
      <div class="lens">
        <button class="drop" class:on={n(k) > 0} aria-expanded={open === k} onclick={() => (open = open === k ? null : k)}>
          {t.lens[k]}{#if n(k)}<span class="badge">{n(k)}</span>{/if}<span class="caret">▾</span>
        </button>
        {#if open === k}
          <div class="pop" role="menu">
            {#if k === 'reach'}
              {#each REACHES as r}
                <label><input type="checkbox" checked={ui.lens.reach.includes(r)} onchange={() => toggle(ui.lens.reach, r)} />{t.reach[r]}<span class="n">{count((o) => o.reach === r)}</span></label>
              {/each}
            {:else if k === 'activities'}
              {#each ACTIVITIES as a}
                <label><input type="checkbox" checked={ui.lens.activities.includes(a)} onchange={() => toggle(ui.lens.activities, a)} />{t.activity[a as keyof typeof t.activity]}<span class="n">{count((o) => o.activities.includes(a))}</span></label>
              {/each}
            {:else}
              <label><input type="radio" name="county" checked={!ui.lens.county} onchange={() => (ui.lens.county = '')} />{t.allCounties}</label>
              <div class="scroll">
                {#each counties as { c, n: cn }}
                  <label><input type="radio" name="county" checked={ui.lens.county === c} onchange={() => (ui.lens.county = c)} />{c}<span class="n">{cn}</span></label>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
    {#if lensActive(ui.lens)}<button class="clear" onclick={clearLens}>{t.clear} ✕</button>{/if}
  </div>
</div>

<style>
  .bar { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
  .chips, .more { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  button { font: inherit; cursor: pointer; }
  .chip, .drop {
    display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: var(--radius);
    border: 1px solid var(--line); background: #fff; color: var(--ink); font-size: 12.5px; white-space: nowrap;
  }
  .chip:hover, .drop:hover { border-color: var(--navy); }
  .chip.on, .drop.on { background: var(--navy); color: #fff; border-color: var(--navy); }
  .dot { width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 0 1.5px #fff; }
  .n { font-size: 11px; opacity: 0.6; font-variant-numeric: tabular-nums; }
  .badge { background: var(--cyan); color: #fff; border-radius: var(--radius-sm); font-size: 10.5px; padding: 0 6px; }
  .caret { font-size: 10px; opacity: 0.6; }
  .lens { position: relative; }
  .pop {
    position: absolute; top: calc(100% + 6px); left: 0; z-index: 20; min-width: 220px; background: #fff;
    border: 1px solid var(--line); border-radius: var(--radius); box-shadow: 0 8px 24px rgba(0, 30, 60, 0.12); padding: 6px; display: flex; flex-direction: column;
  }
  .pop .scroll { max-height: 240px; overflow: auto; display: flex; flex-direction: column; }
  .pop label { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: var(--radius-sm); font-size: 13px; cursor: pointer; }
  .pop label:hover { background: #F1F2F4; }
  .pop label .n { margin-left: auto; }
  input { accent-color: var(--navy); }
  .clear { border: none; background: none; color: var(--navy); font-size: 12px; text-decoration: underline; }
  @media (max-width: 560px) {
    .chips { flex-wrap: nowrap; overflow-x: auto; width: 100%; padding-bottom: 2px; scrollbar-width: none; }
    .pop { position: fixed; left: 12px; right: 12px; top: auto; }
  }
</style>
