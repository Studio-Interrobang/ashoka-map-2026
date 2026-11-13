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
  let appW = $state(0);
  let t = $derived(dict(ui.lang));
  let selectedOrg = $derived(orgs.find((o) => o.id === ui.selected) ?? null);

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

<div class="app" bind:clientWidth={appW}>
  <header>
    <div class="brand">
      <img class="logo" src="./avatars/logo.webp" alt="" width="44" height="44" />
      <div>
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
      </div>
    </div>
    <div class="tools">
      <div class="search-slot"><Search {orgs} {t} /></div>
      <div class="seg" role="tablist" aria-label="View">
        <button role="tab" aria-selected={ui.view === 'map'} onclick={() => (ui.view = 'map')}>{t.map}</button>
        <button role="tab" aria-selected={ui.view === 'clusters'} onclick={() => (ui.view = 'clusters')}>{t.clusters}</button>
        <button role="tab" aria-selected={ui.view === 'table'} onclick={() => (ui.view = 'table')}>{t.table}</button>
      </div>
      <div class="seg lang" role="group" aria-label="Language">
        <button aria-pressed={ui.lang === 'ro'} onclick={() => (ui.lang = 'ro')}>RO</button>
        <button aria-pressed={ui.lang === 'en'} onclick={() => (ui.lang = 'en')}>EN</button>
      </div>
    </div>
  </header>

  {#if orgs.length}<Summary {orgs} {t} />{/if}

  <main>
    <section class="card main">
      <div class="lenses">
        <Lenses {orgs} {t} />
        {#if ui.view === 'clusters'}
          <label class="groupby">{t.groupBy.label}
            <select bind:value={ui.groupBy}>{#each groupings as g}<option value={g}>{t.groupBy[g]}</option>{/each}</select>
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
        {#if selectedOrg}<Detail org={selectedOrg} {t} />{/if}
      </div>
    </section>
  </main>

  <footer>
    <span>{t.source}</span>
    <a href={REPORT_URL} target="_blank" rel="noopener">{t.report} ↗</a>
    <span class="credit">{t.geoCredit}</span>
  </footer>
</div>

<style>
  .app { height: 100%; display: flex; flex-direction: column; gap: 10px; padding: 14px 16px 10px; box-sizing: border-box; background: #fff; color: var(--ink); }
  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; color: var(--navy); padding-bottom: 10px; border-bottom: 2px solid var(--navy); }
  .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .logo { width: 44px; height: 44px; flex: none; }
  h1 { font-size: 19px; font-weight: 800; margin: 0; line-height: 1.15; letter-spacing: -0.01em; }
  .brand p { margin: 1px 0 0; font-size: 13px; font-weight: 300; color: #4a5560; }
  .tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .search-slot { width: 210px; }
  .seg { display: inline-flex; border: 1px solid var(--line); border-radius: var(--radius); padding: 2px; background: #fff; }
  .seg button { font: inherit; font-size: 12.5px; font-weight: 600; border: none; background: none; color: var(--navy); padding: 5px 12px; border-radius: var(--radius-sm); cursor: pointer; }
  .seg button[aria-selected='true'], .seg button[aria-pressed='true'] { background: var(--navy); color: #fff; }
  main { flex: 1; min-height: 0; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
  .card { background: #fff; border: 1px solid var(--line); border-radius: var(--radius); min-height: 0; min-width: 0; }
  .main { display: flex; flex-direction: column; padding: 12px; gap: 8px; }
  .lenses { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
  .groupby { font-size: 12px; color: #4a5560; display: flex; align-items: center; gap: 6px; }
  .groupby select { font: inherit; font-size: 12.5px; padding: 4px 6px; border: 1px solid var(--line); border-radius: var(--radius); background: #fff; color: var(--ink); }
  .stage-wrap { position: relative; flex: 1; min-height: 0; min-width: 0; overflow: hidden; }
  .lenses { min-width: 0; }
  .msg { display: grid; place-items: center; height: 100%; margin: 0; color: #666; }
  .spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid #E1E4E8; border-top-color: var(--cyan); animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(1turn); } }
  footer { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 10.5px; color: #6b6f75; }
  footer a { color: var(--navy); font-weight: 700; }
  .credit { margin-left: auto; }
  @media (max-width: 720px) {
    .app { padding: 10px 10px 8px; gap: 8px; }
    h1 { font-size: 16px; }
    .brand p { font-size: 12px; }
    .tools { width: 100%; }
    .search-slot { flex: 1 1 100%; width: auto; }
    .seg { flex: 1; }
    .seg button { flex: 1; }
    .seg.lang { flex: 0 0 auto; }
    .main { padding: 8px; }
    .credit { margin-left: 0; }
  }
</style>
