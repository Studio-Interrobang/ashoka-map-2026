<script lang="ts">
  import { ui, toggle, clearLens, lensActive } from '../lib/state.svelte';
  import { REACHES, ACTIVITIES, type Org } from '../lib/types';
  import type { Dict } from '../lib/i18n';

  let { orgs, t, narrow = false }: { orgs: Org[]; t: Dict; narrow?: boolean } = $props();
  let sheet = $state(false);
  let total = $derived(ui.lens.reach.length + ui.lens.activities.length + (ui.lens.county ? 1 : 0));
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

{#snippet options(k: Key)}
  {#if k === 'reach'}
    {#each REACHES as r}
      <label><input type="checkbox" checked={ui.lens.reach.includes(r)} onchange={() => toggle(ui.lens.reach, r)} />{t.reach[r]}<span class="n">{count((o) => o.reach === r)}</span></label>
    {/each}
  {:else if k === 'activities'}
    {#each ACTIVITIES as a}
      <label><input type="checkbox" checked={ui.lens.activities.includes(a)} onchange={() => toggle(ui.lens.activities, a)} />{t.activity[a as keyof typeof t.activity]}<span class="n">{count((o) => o.activities.includes(a))}</span></label>
    {/each}
  {:else}
    <label><input type="radio" name="county-{narrow ? 's' : 'p'}" checked={!ui.lens.county} onchange={() => (ui.lens.county = '')} />{t.allCounties}</label>
    <div class="scroll">
      {#each counties as { c, n: cn }}
        <label><input type="radio" name="county-{narrow ? 's' : 'p'}" checked={ui.lens.county === c} onchange={() => (ui.lens.county = c)} />{c}<span class="n">{cn}</span></label>
      {/each}
    </div>
  {/if}
{/snippet}

{#if narrow}
  <button class="drop" class:on={total > 0} onclick={() => (sheet = true)}>{t.filters}{#if total}<span class="badge">{total}</span>{/if}<span class="caret">▾</span></button>
  {#if sheet}
    <div class="sheet-scrim" onclick={() => (sheet = false)} aria-hidden="true"></div>
    <div class="sheet" role="dialog" aria-label={t.filters}>
      <div class="sheet-head"><strong>{t.filters}</strong><button class="done" onclick={() => (sheet = false)}>{t.done}</button></div>
      <div class="sheet-body">
        {#each ['reach', 'activities', 'county'] as const as k}
          <h4>{t.lens[k]}</h4>
          <div class="group">{@render options(k)}</div>
        {/each}
      </div>
      {#if lensActive(ui.lens)}<button class="clear" onclick={clearLens}>{t.clear} ✕</button>{/if}
    </div>
  {/if}
{:else}
<div class="bar">
  <div class="more">
    {#each ['reach', 'activities', 'county'] as const as k}
      <div class="lens">
        <button class="drop" class:on={n(k) > 0} aria-expanded={open === k} onclick={() => (open = open === k ? null : k)}>
          {t.lens[k]}{#if n(k)}<span class="badge">{n(k)}</span>{/if}<span class="caret">▾</span>
        </button>
        {#if open === k}
          <div class="pop" role="menu">{@render options(k)}          </div>
        {/if}
      </div>
    {/each}
    {#if lensActive(ui.lens)}<button class="clear" onclick={clearLens}>{t.clear} ✕</button>{/if}
  </div>
</div>
{/if}

<style>
  .bar { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; }
  .more { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  button { font: inherit; cursor: pointer; }
  .drop {
    display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: var(--radius);
    border: 1px solid var(--line); background: #fff; color: var(--ink); font-size: 12.5px; white-space: nowrap;
  }
  .drop:hover { border-color: var(--navy); }
  .drop.on { background: var(--navy); color: #fff; border-color: var(--navy); }
  .n { font-size: 11px; opacity: 0.6; font-variant-numeric: tabular-nums; }
  .badge { background: var(--cyan); color: #fff; border-radius: var(--radius-sm); font-size: 10.5px; padding: 0 6px; }
  .caret { font-size: 10px; opacity: 0.6; }
  .lens { position: relative; }
  .pop {
    position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; min-width: 220px; background: #fff;
    border: 1px solid var(--line); border-radius: var(--radius); box-shadow: 0 8px 24px rgba(0, 30, 60, 0.12); padding: 6px; display: flex; flex-direction: column;
  }
  .pop .scroll, .sheet .scroll { max-height: 240px; overflow: auto; display: flex; flex-direction: column; }
  .pop :global(label), .sheet :global(label) { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: var(--radius-sm); font-size: 13px; cursor: pointer; }
  .pop :global(label:hover), .sheet :global(label:hover) { background: #F1F2F4; }
  .pop :global(label .n), .sheet :global(label .n) { margin-left: auto; }
  input { accent-color: var(--navy); }
  .clear { border: none; background: none; color: var(--navy); font-size: 12px; text-decoration: underline; }
  .drop { height: 30px; box-sizing: border-box; }
  .sheet-scrim { position: fixed; inset: 0; z-index: 60; background: rgba(0, 63, 114, 0.18); }
  .sheet {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 61; max-height: 80%; display: flex; flex-direction: column;
    background: #fff; border-top: 1px solid var(--line); border-radius: var(--radius) var(--radius) 0 0; box-shadow: 0 -10px 30px rgba(0, 30, 60, 0.15);
    animation: up 0.24s cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes up { from { transform: translateY(100%); } }
  .sheet-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid var(--line); color: var(--navy); }
  .done { font: inherit; font-weight: 700; color: #fff; background: var(--navy); border: none; border-radius: var(--radius); height: 32px; padding: 0 14px; }
  .sheet-body { overflow: auto; padding: 4px 8px 8px; }
  .sheet h4 { margin: 10px 8px 2px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b6f75; }
  .sheet .clear { margin: 6px 14px 12px; align-self: flex-start; }
</style>
