<script lang="ts">
  import { onMount } from 'svelte';
  import Stage from './components/Stage.svelte';
  import Lenses from './components/Lenses.svelte';
  import Detail from './components/Detail.svelte';
  import Table from './components/Table.svelte';
  import Summary from './components/Summary.svelte';
  import Search from './components/Search.svelte';
  import { loadAll, type Counties } from './lib/data';
  import { ui, syncUrl } from './lib/state.svelte';
  import { t as dict } from './lib/i18n';
  import type { Org, GroupBy } from './lib/types';

  const REPORT_URL = 'https://docs.google.com/presentation/d/1xTLer-0hva-A5f5X3Xhb9d3vOc2tuJi3PDh6Ve6CoCw/edit';
  let orgs = $state<Org[]>([]);
  let counties = $state<Counties | null>(null);
  let error = $state('');
  let sw = $state(0);
  let sh = $state(0);
  let appW = $state(1000);
  let t = $derived(dict(ui.lang));
  let selectedOrg = $derived(orgs.find((o) => o.id === ui.selected) ?? null);
  let narrow = $derived(appW < 600);
  let wide = $derived(appW >= 1000);

  let fact = $derived(
    ui.lens.county ? t.facts.county
    : ui.lens.activities.length ? t.facts.activities
    : ui.lens.reach.length ? t.facts.reach
    : ui.lens.clusters.length ? t.facts.clusters
    : t.facts.default,
  );

  onMount(async () => {
    try {
      const r = await loadAll();
      orgs = r.data.orgs;
      counties = r.counties;
    } catch (e) {
      error = String(e);
    }
  });

  // Map = zoomable dots; Clusters = packed bubbles
  $effect(() => { if (ui.view !== 'table') ui.variant = ui.view === 'clusters' ? 'universe' : 'zoom'; });

  $effect(() => {
    ui.lang; ui.view; ui.variant; ui.selected;
    syncUrl();
    document.documentElement.lang = ui.lang;
  });

  const groupings: GroupBy[] = ['none', 'reach', 'cluster', 'county', 'decade'];
</script>

<div class="app" class:narrow class:wide bind:clientWidth={appW}>
  <div class="content" inert={!!selectedOrg}>
    <header class="toolbar">
      {#if ui.header}
        <img class="logo" src="./avatars/logo.webp" alt="" width="28" height="28" />
        <div class="titles">
          <h1>{t.title}</h1>
          {#if wide}<p>{t.subtitle}</p>{/if}
        </div>
      {/if}
      {#if wide || !ui.header}<div class="search-slot"><Search {orgs} {t} /></div>{/if}
      <div class="seg tabs" role="tablist" aria-label="View">
        <button role="tab" aria-selected={ui.view === 'map'} onclick={() => (ui.view = 'map')}>{t.map}</button>
        <button role="tab" aria-selected={ui.view === 'clusters'} onclick={() => (ui.view = 'clusters')}>{t.clusters}</button>
        <button role="tab" aria-selected={ui.view === 'table'} onclick={() => (ui.view = 'table')}>{t.table}</button>
      </div>
      <div class="seg lang" role="group" aria-label="Language">
        <button aria-pressed={ui.lang === 'ro'} onclick={() => (ui.lang = 'ro')}>RO</button>
        <button aria-pressed={ui.lang === 'en'} onclick={() => (ui.lang = 'en')}>EN</button>
      </div>
    </header>

    {#if orgs.length}<Summary {orgs} {t} />{:else}<div class="strip-ph"></div>{/if}

    <div class="filters">
      {#if !wide && ui.header}<div class="search-slot"><Search {orgs} {t} /></div>{/if}
      <Lenses {orgs} {t} {narrow} />
      {#if ui.view === 'clusters'}
        <label class="groupby">{#if !narrow}{t.groupBy.label}{/if}
          <select bind:value={ui.groupBy} aria-label={t.groupBy.label}>{#each groupings as g}<option value={g}>{t.groupBy[g]}</option>{/each}</select>
        </label>
      {/if}
    </div>

    <div class="stage-wrap" bind:clientWidth={sw} bind:clientHeight={sh}>
      {#if error}
        <p class="msg">Could not load data. {error}</p>
      {:else if !counties}
        <div class="msg"><span class="spinner"></span></div>
      {:else if ui.view !== 'table'}
        <Stage {orgs} {counties} w={sw} h={sh} {t} />
      {:else}
        <Table {orgs} {t} />
      {/if}
      {#if ui.view === 'map' && orgs.length && !narrow}<p class="fact caption">{fact}</p>{/if}
    </div>
    {#if ui.view !== 'map' && !narrow}<p class="fact row">{fact}</p>{/if}

    <footer>
      <span class="src">{t.source}</span>
      <a href={REPORT_URL} target="_blank" rel="noopener">{t.report} ↗</a>
      {#if ui.view === 'map'}<span class="credit">{t.geoCredit}</span>{/if}
    </footer>
  </div>

  {#if selectedOrg}<Detail org={selectedOrg} {t} {narrow} />{/if}
</div>

<style>
  .app { position: relative; height: 100%; container-type: inline-size; background: #fff; color: var(--ink); overflow: hidden; }
  .content {
    height: 100%; box-sizing: border-box; padding: 10px 12px 8px;
    display: grid; grid-template-rows: auto auto auto minmax(0, 1fr) auto auto; gap: 8px; min-width: 0;
  }

  /* toolbar: one 36px row */
  .toolbar { display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 36px; }
  .logo { width: 28px; height: 28px; flex: none; }
  .titles { flex: 1; min-width: 0; }
  h1 { font-size: 15px; font-weight: 800; color: var(--navy); margin: 0; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .titles p { margin: 0; font-size: 12px; color: #4a5560; font-weight: 300; }
  .wide h1 { font-size: 17px; }
  .search-slot { width: 190px; flex: none; }
  .seg { display: inline-flex; flex: none; border: 1px solid var(--line); border-radius: var(--radius); padding: 2px; background: #fff; }
  .seg button { font: inherit; font-size: 12.5px; font-weight: 600; border: none; background: none; color: var(--navy); height: 28px; padding: 0 11px; border-radius: var(--radius-sm); cursor: pointer; }
  .seg button[aria-selected='true'], .seg button[aria-pressed='true'] { background: var(--navy); color: #fff; }

  .filters { display: flex; align-items: center; gap: 6px; min-width: 0; flex-wrap: wrap; }
  .filters .search-slot { width: 180px; }
  .groupby { margin-left: auto; font-size: 12px; color: #4a5560; display: flex; align-items: center; gap: 6px; }
  .groupby select { font: inherit; font-size: 12.5px; height: 30px; padding: 0 6px; border: 1px solid var(--line); border-radius: var(--radius); background: #fff; color: var(--ink); }

  .stage-wrap { position: relative; min-height: 0; min-width: 0; overflow: hidden; border: 1px solid var(--line); border-radius: var(--radius); }
  .strip-ph { height: 70px; background: #F3F4F6; border-radius: var(--radius); }
  .msg { display: grid; place-items: center; height: 100%; margin: 0; color: #666; }
  .spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid #E1E4E8; border-top-color: var(--cyan); animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(1turn); } }

  .fact { margin: 0; font-size: 12px; line-height: 1.35; color: #4a5560; border-left: 3px solid var(--cyan); padding: 3px 8px; }
  .fact.caption { position: absolute; left: 10px; top: 10px; max-width: min(46%, 380px); background: rgba(255, 255, 255, 0.88); pointer-events: none; }
  .fact.row:empty { display: none; }

  footer { display: flex; gap: 14px; font-size: 10.5px; color: #6b6f75; white-space: nowrap; min-width: 0; }
  footer .src { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  footer a { color: var(--navy); font-weight: 700; flex: none; }
  .credit { margin-left: auto; flex: none; }

  /* phones */
  .narrow .content { padding: 8px; gap: 6px; }
  .narrow .toolbar { flex-wrap: wrap; row-gap: 6px; }
  .narrow .titles { flex: 1 1 0; }
  .narrow h1 { font-size: 14px; }
  .narrow .tabs { order: 3; flex: 1 1 100%; }
  .narrow .tabs button { flex: 1; }
  .narrow .filters .search-slot { flex: 1; width: auto; }
  .narrow footer { flex-wrap: wrap; white-space: normal; gap: 2px 10px; }
  .narrow .credit { margin-left: 0; }
  .wide .content { padding: 12px 14px 10px; }
</style>
