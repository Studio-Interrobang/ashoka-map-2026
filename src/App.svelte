<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import Stage from './components/Stage.svelte';
  import Lenses from './components/Lenses.svelte';
  import Detail from './components/Detail.svelte';
  import Table from './components/Table.svelte';
  import Summary from './components/Summary.svelte';
  import Search from './components/Search.svelte';
  import Intro from './components/Intro.svelte';
  import { loadAll, type Counties } from './lib/data';
  import { ui, syncUrl, matches, lensActive } from './lib/state.svelte';
  import { exportViz } from './lib/exportViz';
  import { t as dict } from './lib/i18n';
  import { CLUSTERS, type Org, type GroupBy } from './lib/types';
  // AA-contrast text tones of the cluster colours (same as the summary strip)
  const TONE = { C1: '#003F72', C2: '#00639a', C3: '#006b59', C4: '#9a5600' } as const;

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
  /** desktop: the logo is as tall as title + subtitle + intro */
  let titlesH = $state(0);
  let shownN = $derived(orgs.filter((o) => matches(o, ui.lens)).length);
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
      // walkthrough: ?intro=1 always, ?intro=0 never, otherwise once per browser
      let seen = false;
      try { seen = localStorage.getItem('ashokaIntroSeen') === '1'; } catch { /* blocked storage */ }
      if (ui.introParam === '1' || (ui.introParam !== '0' && !seen)) openIntro();
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
  function openIntro() { ui.selected = null; ui.intro = true; }

  // ---- download (Map / Clusters) ----
  let stageRef = $state<{ chartEls: () => { svg: SVGSVGElement; overlay: HTMLElement | null }; withFullView: <T>(fn: () => Promise<T>) => Promise<T>; setExportSize: (s: { w: number; h: number } | null) => Promise<void> } | undefined>();
  let dlOpen = $state(false);
  let busy = $state(false);
  function describe() {
    const l = ui.lens;
    const parts: string[] = [];
    if (l.clusters.length) parts.push(`${t.lens.clusters}: ${l.clusters.map((c) => t.cluster[c]).join(', ')}`);
    if (l.reach.length) parts.push(`${t.lens.reach}: ${l.reach.map((r) => t.reach[r]).join(', ')}`);
    if (l.activities.length) parts.push(`${t.lens.activities}: ${l.activities.map((a) => t.activity[a as keyof typeof t.activity]).join(', ')}`);
    if (l.county) parts.push(`${t.lens.county}: ${l.county}`);
    return [
      `${t.filtersLabel}: ${lensActive(l) ? parts.join(' · ') : t.noFilters}`,
    ];
  }
  async function download(fmt: 'png' | 'jpg') {
    dlOpen = false;
    const ref = stageRef;
    if (!ref) return;
    busy = true;
    try {
      const run = async () => {
        const { svg, overlay } = ref.chartEls();
        await exportViz(fmt, {
          svg, overlay: ui.view === 'clusters' ? overlay : null,
          title: t.title, subtitle: t.subtitle, lines: describe(),
          summary: {
            total: shownN,
            label: `${shownN === orgs.length ? '' : `${t.of} ${orgs.length} `}${t.organisations}`,
            clusters: CLUSTERS.map((c) => ({ c, n: orgs.filter((o) => matches(o, ui.lens) && o.clusters.includes(c)).length, name: t.cluster[c], tone: TONE[c] })),
          },
          footer: [t.source, ui.view === 'map' ? t.geoCredit : ''].filter(Boolean),
          social: narrow ? 1.25 : undefined,
          // Clusters on phones: re-lay the bubbles for the image (at a 620px-wide scale so labels stay proportionate)
          fitTo: narrow && ui.view === 'clusters' ? (aw, ah) => ref.setExportSize({ w: 620, h: (ah * 620) / aw }) : undefined,
          filename: `ashoka-${ui.view === 'map' ? 'map' : 'clusters'}-2026-${ui.lang}`,
        });
      };
      await (narrow && ui.view === 'map' ? ref.withFullView(run) : run());
    } finally { busy = false; await ref.setExportSize(null); }
  }
  // the Clusters view doesn't offer a filter for the dimension it is grouped by
  const groupLens = { cluster: 'clusters', reach: 'reach', activity: 'activities' } as const;
  let hide = $derived(ui.view === 'clusters' ? [groupLens[ui.groupBy]] : []);
  $effect(() => {
    if (ui.view !== 'clusters') return;
    const k = groupLens[ui.groupBy];
    untrack(() => { ui.lens[k].length = 0; });
  });
</script>

<svelte:window onclick={(e) => { if (!(e.target as HTMLElement).closest('.dl')) dlOpen = false; }} />

<div class="app" class:narrow class:wide bind:clientWidth={appW}>
  <div class="content" inert={!!selectedOrg || ui.intro}>
    {#if ui.header}
      <header class="masthead">
        <img class="logo" src="./avatars/logo.webp" alt="" width="76" height="76" style={!narrow && titlesH ? `width:${titlesH}px;height:${titlesH}px` : ""} />
        <div class="titles" bind:clientHeight={titlesH}>
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
      <button class="howto" onclick={openIntro} title={t.howTo} aria-label={t.howTo}>
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="6.5"/><path d="M6.6 5.4v5.2L10.8 8z" fill="currentColor" stroke="none"/></svg>
        {#if !narrow}<span>{t.howTo}</span>{/if}
      </button>
      <label class="lang" title={t.language}>
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="6.5"/><path d="M1.5 8h13M8 1.5c2 2.2 2 10.8 0 13M8 1.5c-2 2.2-2 10.8 0 13"/></svg>
        <select bind:value={ui.lang} aria-label={t.language}><option value="ro">RO</option><option value="en">EN</option></select>
        <span class="caret" aria-hidden="true">▾</span>
      </label>
    </div>

    {#if !narrow}
      {#if orgs.length}<Summary {orgs} {t} />{:else}<div class="strip-ph"></div>{/if}
    {/if}

    <div class="filters">
      {#if narrow && orgs.length}
        <div class="kpi"><span class="num">{shownN}</span><span class="lbl">{shownN === orgs.length ? '' : `${t.of} ${orgs.length} `}{t.organisations}</span></div>
      {/if}
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
        <Stage bind:this={stageRef} {orgs} {counties} w={sw} h={sh} {t} />
      {:else}
        <Table {orgs} {t} />
      {/if}
      {#if ui.view === 'map' && orgs.length && !narrow && fact}<p class="fact caption">{fact}</p>{/if}
    </div>
    {#if ui.view !== 'map' && !narrow && fact}<p class="fact row">{fact}</p>{/if}

    <footer>
      <div class="row">
        <span class="src">{t.source}</span>
        <a href={REPORT_URL} target="_blank" rel="noopener">{t.report} ↗</a>
        {#if ui.view !== 'table' && counties}
          <div class="dl">
            {#if dlOpen}
              <div class="dl-menu" role="menu">
                <button role="menuitem" onclick={() => download('png')}>PNG</button>
                <button role="menuitem" onclick={() => download('jpg')}>JPG</button>
              </div>
            {/if}
            <button class="dl-btn" aria-expanded={dlOpen} disabled={busy} onclick={() => (dlOpen = !dlOpen)}>
              <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 13.5h11"/></svg>
              {t.download}
            </button>
          </div>
        {/if}
      </div>
      {#if ui.view === 'map'}<div class="credit">{t.geoCredit}</div>{/if}
    </footer>
  </div>

  {#if selectedOrg}<Detail org={selectedOrg} {t} {narrow} />{/if}
  {#if ui.intro && counties && orgs.length}<Intro {orgs} {counties} {t} {narrow} />{/if}
</div>

<style>
  .app { position: relative; height: 100%; container-type: inline-size; background: #fff; color: var(--ink); overflow: hidden; }
  .content {
    height: 100%; box-sizing: border-box; padding: 10px 12px 8px;
    display: flex; flex-direction: column; gap: 8px; min-width: 0;
  }
  .content > * { flex: none; }
  .content > .stage-wrap { flex: 1 1 0; min-height: 0;
  }

  /* masthead: logo + title, subtitle, intro */
  .masthead { display: flex; align-items: center; gap: 12px; min-width: 0; padding-bottom: 8px; }
  .logo { width: 76px; height: 76px; flex: none; }
  .titles { flex: 1; min-width: 0; }
  h1 { font-size: 22px; font-weight: 800; color: var(--navy); margin: 0; line-height: 1.15; }
  .titles .sub { margin: 2px 0 0; font-size: 14px; font-weight: 700; color: var(--cyan-text); }
  .titles .intro { margin: 2px 0 0; font-size: 12.5px; line-height: 1.35; color: #4a5560; }
  .wide h1 { font-size: 26px; }
  .wide .logo { width: 84px; height: 84px; }


  /* toolbar: search · views · language */
  .toolbar { display: flex; align-items: center; gap: 8px; min-width: 0; min-height: 34px; }
  .toolbar .search-slot { flex: 1; min-width: 0; max-width: 260px; margin-right: auto; }
  .seg { display: inline-flex; flex: none; border: 1px solid var(--line); border-radius: var(--radius); padding: 2px; background: #fff; }
  .seg button { font: inherit; font-size: 12.5px; font-weight: 600; border: none; background: none; color: var(--navy); height: 28px; padding: 0 11px; border-radius: var(--radius-sm); cursor: pointer; }
  .seg button[aria-selected='true'] { background: var(--navy); color: #fff; }

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

  footer { font-size: 10.5px; color: #6b6f75; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  footer .row { display: flex; align-items: center; gap: 14px; white-space: nowrap; min-width: 0; }
  footer .src { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  footer a { color: var(--navy); font-weight: 700; flex: none; }

  .howto { display: inline-flex; align-items: center; gap: 5px; flex: none; height: 30px; padding: 0 6px; border: none; background: none; font: inherit; font-size: 12px; font-weight: 600; color: #4a5560; cursor: pointer; }
  .howto:hover { color: var(--navy); }

  /* language: quiet globe dropdown so the view tabs lead */
  .lang { position: relative; display: inline-flex; align-items: center; gap: 4px; flex: none; color: #4a5560; font-size: 12px; padding: 0 4px; height: 30px; cursor: pointer; }
  .lang select { appearance: none; -webkit-appearance: none; border: none; background: none; font: inherit; font-weight: 600; color: inherit; padding: 0 12px 0 0; margin-right: -10px; cursor: pointer; }
  .lang .caret { font-size: 9px; opacity: 0.7; pointer-events: none; }
  .lang:hover { color: var(--navy); }

  /* download */
  .dl { position: relative; margin-left: auto; flex: none; }
  .dl-btn { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px; font: inherit; font-size: 12px; font-weight: 600; color: var(--navy); background: #fff; border: 1px solid var(--line); border-radius: var(--radius); cursor: pointer; }
  .dl-btn:hover { background: #F3F4F6; }
  .dl-btn:disabled { opacity: 0.6; cursor: progress; }
  .dl-menu { position: absolute; right: 0; bottom: calc(100% + 4px); z-index: 30; display: flex; flex-direction: column; background: #fff; border: 1px solid var(--line); border-radius: var(--radius); box-shadow: 0 8px 24px rgba(0, 30, 60, 0.12); padding: 4px; }
  .dl-menu button { font: inherit; font-size: 12.5px; text-align: left; border: none; background: none; padding: 6px 14px; border-radius: var(--radius-sm); cursor: pointer; color: var(--ink); }
  .dl-menu button:hover { background: #F1F2F4; }

  /* phones */
  .narrow .content { padding: 8px; gap: 6px; }
  .narrow .logo { width: 52px; height: 52px; }
  .narrow h1 { font-size: 17px; }
  .narrow .titles .sub { font-size: 12.5px; }
  .narrow .toolbar { flex-wrap: wrap; row-gap: 6px; }
  .narrow .toolbar .search-slot { flex: 1 1 100%; max-width: none; order: 3; }
  .narrow .tabs { flex: 1; }
  .narrow .tabs button { flex: 1; }
  .narrow footer .row { flex-wrap: wrap; white-space: normal; gap: 2px 10px; }
  .narrow footer .src { flex: 1 1 100%; }

  /* phones: just the total, left, next to the Filters button */
  .kpi { display: flex; align-items: baseline; gap: 6px; margin-right: auto; min-width: 0; }
  /* phones: total · Filters · Group by on one row */
  .narrow .filters { flex-wrap: nowrap; }
  .narrow .groupby { margin-left: 0; flex: 0 1 auto; min-width: 0; }
  .narrow .groupby select { max-width: 132px; min-width: 0; text-overflow: ellipsis; }
  .kpi .num { font-size: 30px; font-weight: 800; color: var(--cyan-text); line-height: 1; font-variant-numeric: tabular-nums; }
  .kpi .lbl { font-size: 13px; font-weight: 700; color: var(--ink); }
  .wide .content { padding: 12px 14px 10px; }
</style>
