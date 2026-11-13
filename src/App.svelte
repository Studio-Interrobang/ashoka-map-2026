<script lang="ts">
  import { onMount, untrack } from 'svelte';
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
    : '',
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

  const groupings: GroupBy[] = ['cluster', 'reach', 'activity'];
  // the Clusters view doesn't offer a filter for the dimension it is grouped by
  const groupLens = { cluster: 'clusters', reach: 'reach', activity: 'activities' } as const;
  let hide = $derived(ui.view === 'clusters' ? [groupLens[ui.groupBy]] : []);
  $effect(() => {
    if (ui.view !== 'clusters') return;
    const k = groupLens[ui.groupBy];
    untrack(() => { ui.lens[k].length = 0; });
  });
</script>

<div class="app" class:narrow class:wide bind:clientWidth={appW}>
  <div class="content" inert={!!selectedOrg}>
    {#if ui.header}
      <header class="masthead">
        <img class="logo" src="./avatars/logo.webp" alt="" width="56" height="56" />
        <div class="titles">
          <h1>{t.title}</h1>
          <p class="sub">{t.subtitle}</p>
          {#if !narrow}<p class="intro">{t.intro}</p>{/if}
        </div>
      </header>
    {/if}
    <div class="toolbar">
      <div class="search-slot"><Search {orgs} {t} /></div>
      <div class="seg tabs" role="tablist" aria-label="View">
        <button role="tab" aria-selected={ui.view === 'map'} onclick={() => (ui.view = 'map')}>{t.map}</button>
        <button role="tab" aria-selected={ui.view === 'clusters'} onclick={() => (ui.view = 'clusters')}>{t.clusters}</button>
        <button role="tab" aria-selected={ui.view === 'table'} onclick={() => (ui.view = 'table')}>{t.table}</button>
      </div>
      <div class="seg lang" role="group" aria-label="Language">
        <button aria-pressed={ui.lang === 'ro'} onclick={() => (ui.lang = 'ro')}>RO</button>
        <button aria-pressed={ui.lang === 'en'} onclick={() => (ui.lang = 'en')}>EN</button>
      </div>
    </div>

    {#if orgs.length}<Summary {orgs} {t} />{:else}<div class="strip-ph"></div>{/if}

    <div class="filters">
      <Lenses {orgs} {t} {narrow} {hide} />
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
      {#if ui.view === 'map' && orgs.length && !narrow && fact}<p class="fact caption">{fact}</p>{/if}
    </div>
    {#if ui.view !== 'map' && !narrow && fact}<p class="fact row">{fact}</p>{/if}

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
    display: grid; grid-template-rows: auto auto auto auto minmax(0, 1fr) auto auto; gap: 8px; min-width: 0;
  }

  /* masthead: logo + title, subtitle, intro */
  .masthead { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .logo { width: 56px; height: 56px; flex: none; }
  .titles { flex: 1; min-width: 0; }
  h1 { font-size: 22px; font-weight: 800; color: var(--navy); margin: 0; line-height: 1.15; }
  .titles .sub { margin: 2px 0 0; font-size: 14px; font-weight: 700; color: var(--cyan-text); }
  .titles .intro { margin: 2px 0 0; font-size: 12.5px; line-height: 1.35; color: #4a5560; }
  .wide h1 { font-size: 26px; }
  .wide .logo { width: 64px; height: 64px; }

  /* toolbar: search · views · language */
  .toolbar { display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 34px; }
  .toolbar .search-slot { flex: 1; min-width: 0; max-width: 260px; margin-right: auto; }
  .seg { display: inline-flex; flex: none; border: 1px solid var(--line); border-radius: var(--radius); padding: 2px; background: #fff; }
  .seg button { font: inherit; font-size: 12.5px; font-weight: 600; border: none; background: none; color: var(--navy); height: 28px; padding: 0 11px; border-radius: var(--radius-sm); cursor: pointer; }
  .seg button[aria-selected='true'], .seg button[aria-pressed='true'] { background: var(--navy); color: #fff; }

  .filters { display: flex; align-items: center; gap: 6px; min-width: 0; flex-wrap: wrap; }
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
  .narrow .logo { width: 40px; height: 40px; }
  .narrow h1 { font-size: 17px; }
  .narrow .titles .sub { font-size: 12.5px; }
  .narrow .toolbar { flex-wrap: wrap; row-gap: 6px; }
  .narrow .toolbar .search-slot { flex: 1 1 100%; max-width: none; order: 3; }
  .narrow .tabs { flex: 1; }
  .narrow .tabs button { flex: 1; }
  .narrow footer { flex-wrap: wrap; white-space: normal; gap: 2px 10px; }
  .narrow .credit { margin-left: 0; }
  .wide .content { padding: 12px 14px 10px; }
</style>
