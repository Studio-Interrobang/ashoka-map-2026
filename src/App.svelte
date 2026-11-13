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
  import type { Org, Variant, GroupBy } from './lib/types';

  const REPORT_URL = 'https://docs.google.com/presentation/d/1xTLer-0hva-A5f5X3Xhb9d3vOc2tuJi3PDh6Ve6CoCw/edit';
  let orgs = $state<Org[]>([]);
  let counties = $state<Counties | null>(null);
  let error = $state('');
  let sw = $state(0);
  let sh = $state(0);
  let appW = $state(0);
  let t = $derived(dict(ui.lang));
  let selectedOrg = $derived(orgs.find((o) => o.id === ui.selected) ?? null);
  let wide = $derived(appW >= 980);

  onMount(async () => {
    try {
      const r = await loadAll();
      orgs = r.data.orgs;
      counties = r.counties;
    } catch (e) {
      error = String(e);
    }
  });

  $effect(() => {
    ui.lang; ui.view; ui.variant; ui.selected;
    syncUrl();
    document.documentElement.lang = ui.lang;
  });

  const variants: Variant[] = ['bloom', 'zoom', 'choropleth', 'dorling', 'universe'];
  const groupings: GroupBy[] = ['none', 'reach', 'cluster', 'county', 'decade'];
</script>

<div class="app" bind:clientWidth={appW}>
  <header>
    <div class="brand">
      <svg class="logo" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="16" fill="none" stroke="#0088CE" stroke-width="6" stroke-dasharray="6 3" />
        <circle cx="20" cy="20" r="7" fill="#fff" />
      </svg>
      <div>
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
      </div>
    </div>
    <div class="tools">
      <div class="search-slot"><Search {orgs} {t} /></div>
      <div class="seg" role="tablist" aria-label="View">
        <button role="tab" aria-selected={ui.view === 'map'} onclick={() => (ui.view = 'map')}>{t.map}</button>
        <button role="tab" aria-selected={ui.view === 'table'} onclick={() => (ui.view = 'table')}>{t.table}</button>
      </div>
      <div class="seg lang" role="group" aria-label="Language">
        <button aria-pressed={ui.lang === 'ro'} onclick={() => (ui.lang = 'ro')}>RO</button>
        <button aria-pressed={ui.lang === 'en'} onclick={() => (ui.lang = 'en')}>EN</button>
      </div>
    </div>
  </header>

  {#if ui.lab}
    <div class="lab-bar">
      <span class="lab-tag">LAB</span>
      {#each variants as v}
        <button class:on={ui.variant === v} onclick={() => { ui.variant = v; ui.view = 'map'; }}>{t.variants[v]}</button>
      {/each}
      <span class="sep"></span>
      <button class:on={!ui.textured} onclick={() => (ui.textured = false)}>Simple discs</button>
      <button class:on={ui.textured} onclick={() => (ui.textured = true)}>Textured avatars</button>
      {#if ui.variant === 'universe'}
        <span class="sep"></span>
        <label>{t.groupBy.label}
          <select bind:value={ui.groupBy}>{#each groupings as g}<option value={g}>{t.groupBy[g]}</option>{/each}</select>
        </label>
      {/if}
    </div>
  {/if}

  <main class:wide>
    <section class="card main">
      <div class="lenses"><Lenses {orgs} {t} /></div>
      <div class="stage-wrap" bind:clientWidth={sw} bind:clientHeight={sh}>
        {#if error}
          <p class="msg">Could not load data. {error}</p>
        {:else if !counties}
          <div class="msg"><span class="spinner"></span></div>
        {:else if ui.view === 'map'}
          <Stage {orgs} {counties} w={sw} h={sh} {t} />
        {:else}
          <Table {orgs} {t} />
        {/if}
        {#if selectedOrg}<Detail org={selectedOrg} {t} />{/if}
      </div>
      {#if !wide && orgs.length}<div class="strip"><Summary {orgs} {t} /></div>{/if}
    </section>
    {#if wide && orgs.length}
      <aside class="card side"><Summary {orgs} {t} vertical /></aside>
    {/if}
  </main>

  <footer>
    <span>{t.source}</span>
    <a href={REPORT_URL} target="_blank" rel="noopener">{t.report} ↗</a>
    <span class="credit">{t.geoCredit}</span>
  </footer>
</div>

<style>
  .app { height: 100%; display: flex; flex-direction: column; gap: 10px; padding: 14px 16px 10px; box-sizing: border-box; background: var(--navy); color: var(--ink); }
  header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; color: #fff; }
  .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .logo { width: 34px; height: 34px; flex: none; }
  h1 { font-size: 19px; font-weight: 800; margin: 0; line-height: 1.15; letter-spacing: -0.01em; }
  .brand p { margin: 1px 0 0; font-size: 13px; font-weight: 300; opacity: 0.85; }
  .tools { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .search-slot { width: 210px; }
  .seg { display: inline-flex; background: rgba(255, 255, 255, 0.12); border-radius: 999px; padding: 3px; }
  .seg button { font: inherit; font-size: 12.5px; font-weight: 600; border: none; background: none; color: #fff; padding: 5px 12px; border-radius: 999px; cursor: pointer; }
  .seg button[aria-selected='true'], .seg button[aria-pressed='true'] { background: #fff; color: var(--navy); }
  .lab-bar { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; color: #fff; font-size: 12px; }
  .lab-bar button { font: inherit; font-size: 12px; border: 1px dashed rgba(255,255,255,.5); background: none; color: #fff; padding: 4px 10px; border-radius: 999px; cursor: pointer; }
  .lab-bar button.on { background: var(--orange); border-color: var(--orange); color: #1b1b1b; font-weight: 700; }
  .lab-tag { background: var(--orange); color: #1b1b1b; font-weight: 800; font-size: 10px; padding: 3px 6px; border-radius: 4px; letter-spacing: 0.08em; }
  .lab-bar select { font: inherit; font-size: 12px; margin-left: 6px; border-radius: 6px; }
  .sep { width: 1px; height: 18px; background: rgba(255,255,255,.3); margin: 0 4px; }
  main { flex: 1; min-height: 0; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
  main.wide { grid-template-columns: minmax(0, 1fr) 250px; }
  .card { background: #fff; border-radius: 18px; min-height: 0; min-width: 0; }
  .main { display: flex; flex-direction: column; padding: 12px; gap: 8px; }
  .side { padding: 18px 16px; overflow: auto; }
  .stage-wrap { position: relative; flex: 1; min-height: 0; min-width: 0; overflow: hidden; }
  .lenses { min-width: 0; }
  .strip { border-top: 1px solid #EEEBE2; padding-top: 8px; }
  .msg { display: grid; place-items: center; height: 100%; margin: 0; color: #666; }
  .spinner { width: 28px; height: 28px; border-radius: 50%; border: 3px solid #DAD7CB; border-top-color: var(--cyan); animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(1turn); } }
  footer { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 10.5px; color: rgba(255, 255, 255, 0.75); }
  footer a { color: #fff; font-weight: 700; }
  .credit { margin-left: auto; }
  @media (max-width: 720px) {
    .app { padding: 10px 10px 8px; gap: 8px; }
    h1 { font-size: 16px; }
    .brand p { font-size: 12px; }
    .tools { width: 100%; }
    .search-slot { flex: 1; width: auto; }
    .main { padding: 8px; border-radius: 14px; }
    .credit { margin-left: 0; }
  }
</style>
