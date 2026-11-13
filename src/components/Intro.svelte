<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { geoPath } from 'd3-geo';
  import { avatarUrl, type Counties } from '../lib/data';
  import { packEqual, fitProjection, zoomSpread } from '../lib/layouts';
  import { ui } from '../lib/state.svelte';
  import { CLUSTERS, CLUSTER_COLORS, REACHES, type Org } from '../lib/types';
  import { deRo, type Dict } from '../lib/i18n';

  /**
   * "How to read" walkthrough, shown as a pop-up over the app:
   * 0 avatar built from the four cluster slices → 1 two real examples → 2 scale of work →
   * 3 all organisations packed as one bubble → 4 the bubble spreads onto the map → closes.
   */
  let { orgs, counties, t, narrow = false }: { orgs: Org[]; counties: Counties; t: Dict; narrow?: boolean } = $props();

  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DUR = [6500, 6500, 6500, 5500, 6500];
  const LAST = DUR.length - 1;

  let step = $state(0);
  let playing = $state(!reduce);
  let started = $state(false); // waits until the embed is on screen
  let shown = $state(reduce ? 4 : 0); // cluster slices revealed in step 0
  let root: HTMLDivElement | undefined = $state();
  let closeBtn: HTMLButtonElement | undefined = $state();
  let sw = $state(0);
  let sh = $state(0);

  // ---- data-driven copy ----
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // {k} → value; {de:k} → value + Romanian "de" where grammar needs it
  const val = (v: Record<string, string | number>, k: string, de: boolean) => `${v[k] ?? ''}${de && typeof v[k] === 'number' ? ' ' + deRo(v[k] as number).trim() : ''}`.trimEnd();
  const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(de:)?(\w+)\}/g, (_, de, k) => val(v, k, !!de));
  /** same, as HTML with every figure in bold (values come from the sheet, so they are escaped) */
  const fillBold = (s: string, v: Record<string, string | number>) => esc(s).replace(/\{(de:)?(\w+)\}/g, (_, de, k) => `<strong>${esc(val(v, k, !!de))}</strong>`);
  let stats = $derived.by(() => {
    const byUat = new Map<string, number>();
    for (const o of orgs) byUat.set(o.uat, (byUat.get(o.uat) ?? 0) + 1);
    const [top, topN] = [...byUat].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
    const reach = Object.fromEntries(REACHES.map((r) => [r, orgs.filter((o) => o.reach === r).length]));
    return {
      n: orgs.length,
      multi: orgs.filter((o) => o.clusters.length > 1).length,
      counties: new Set(orgs.map((o) => o.county)).size,
      top, topN,
      local: reach.Local, national: reach.National, intl: reach.International,
    };
  });
  let cap = $derived(t.walk.steps[step]);

  // the report's own examples, with a fallback to any two-cluster organisations
  let examples = $derived.by(() => {
    const pick = (re: RegExp) => orgs.find((o) => re.test(o.short));
    const two = orgs.filter((o) => o.clusters.length === 2);
    const a = pick(/urbanizehub/i) ?? two[0];
    const b = pick(/aide/i) ?? two.find((o) => o !== a && o.clusters.join() !== a?.clusters.join()) ?? two[1];
    return [a, b].filter(Boolean) as Org[];
  });
  let scaleCombo = $derived(examples[0]?.clusters.join('') ?? 'C1C2');

  // ---- geometry for the 127-avatar scenes ----
  let D = $derived(Math.min(sw * 0.8, sh * 0.82, 340)); // built-avatar size
  let pack = $derived.by(() => {
    if (!sw || !sh) return null;
    const target = Math.min(sw, sh) * 0.86;
    const probe = packEqual(orgs, 10, 0.6).R * 2;
    const rp = (10 * target) / probe;
    const p = packEqual(orgs, rp, rp * 0.06);
    return { rp, pos: new Map(p.circles.map((c) => [c.id, { x: sw / 2 + c.dx, y: sh / 2 + c.dy }])) };
  });
  let map = $derived.by(() => {
    if (!sw || !sh) return null;
    const pad = narrow ? 6 : 14;
    const projection = fitProjection(counties, pad, pad, sw - pad, sh - pad);
    const rm = Math.max(3.5, Math.min(sw, sh * 1.4) / 85);
    return { path: geoPath(projection), rm, pos: zoomSpread(orgs, projection, 1, rm) };
  });
  // fly-out order: from the centre of the bubble outwards
  let order = $derived.by(() => {
    if (!pack) return new Map<string, number>();
    const d = (id: string) => { const p = pack!.pos.get(id)!; return Math.hypot(p.x - sw / 2, p.y - sh / 2); };
    return new Map([...orgs].sort((a, b) => d(a.id) - d(b.id)).map((o, i) => [o.id, i]));
  });

  function orgStyle(o: Org) {
    if (!pack || !map) return 'opacity:0';
    const p = pack.pos.get(o.id)!;
    const i = order.get(o.id) ?? 0;
    if (step < 3) return `transform:translate(${p.x - pack.rp}px,${p.y - pack.rp}px) scale(.2);opacity:0;transition-delay:0ms`;
    if (step === 3) return `transform:translate(${p.x - pack.rp}px,${p.y - pack.rp}px) scale(1);opacity:1;transition-delay:${i * 6}ms`;
    const m = map.pos.get(o.id)!;
    return `transform:translate(${m.x - pack.rp}px,${m.y - pack.rp}px) scale(${map.rm / pack.rp});opacity:1;transition-delay:${i * 5}ms`;
  }

  // ---- timeline ----
  $effect(() => {
    if (!started || step !== 0 || shown >= 4) return;
    const id = setTimeout(() => shown++, shown === 0 ? 500 : 850);
    return () => clearTimeout(id);
  });
  $effect(() => {
    if (!started || !playing) return;
    const s = step;
    const id = setTimeout(() => (s === LAST ? close() : (step = s + 1)), DUR[s]);
    return () => clearTimeout(id);
  });

  function go(s: number) { playing = false; step = Math.max(0, Math.min(LAST, s)); if (step === 0) shown = 4; }
  function close() {
    try { localStorage.setItem('ashokaIntroSeen', '1'); } catch { /* storage blocked: it will just show again */ }
    ui.intro = false;
  }

  onMount(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeBtn?.focus();
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { started = true; io.disconnect(); } }, { threshold: 0.3 });
    if (root) io.observe(root);
    return () => { io.disconnect(); opener?.focus?.(); };
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') go(step + 1);
    else if (e.key === 'ArrowLeft') go(step - 1);
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="scrim" transition:fade={{ duration: reduce ? 0 : 200 }}></div>
<div
  class="intro"
  class:narrow
  class:reduce
  bind:this={root}
  role="dialog"
  aria-modal="true"
  aria-labelledby="intro-title"
  transition:fade={{ duration: reduce ? 0 : 280 }}
>
  <div class="top">
    <span class="kicker">{t.walk.kicker}</span>
    <button class="x" bind:this={closeBtn} onclick={close} aria-label={t.detail.close}>✕</button>
  </div>

  <div class="stage" bind:clientWidth={sw} bind:clientHeight={sh} aria-hidden="true">
    <!-- 4/5: map -->
    {#if map}
      <svg class="counties" class:on={step === 4} width={sw} height={sh}>
        {#each counties.features as f (f.properties.name)}<path d={map.path(f)} />{/each}
      </svg>
    {/if}

    <!-- 0: the avatar, built slice by slice -->
    <div class="built" class:on={step === 0} style="width:{D}px;height:{D}px">
      {#each CLUSTERS as c, i}
        <img
          src="./avatars/quad-{c}.webp" alt=""
          class:in={i < shown}
        />
      {/each}
    </div>

    <!-- 1: two real organisations -->
    <div class="row examples" class:on={step === 1}>
      {#each examples as o}
        <figure>
          <img src={avatarUrl(o.avatar, 'l')} alt="" />
          <figcaption>
            <strong>{o.short}</strong>
            {#each o.clusters as c}<span class="cl"><i style="background:{CLUSTER_COLORS[c]}"></i>{t.cluster[c]}</span>{/each}
            <span class="city">{o.uat}</span>
          </figcaption>
        </figure>
      {/each}
    </div>

    <!-- 2: scale of work -->
    <div class="row scale" class:on={step === 2}>
      {#each REACHES as r, i}
        <figure style="transition-delay:{step === 2 ? i * 350 : 0}ms">
          <img src="./avatars/{scaleCombo}_{r}-l.webp" alt="" />
          <figcaption><strong>{t.reach[r]}</strong></figcaption>
        </figure>
      {/each}
    </div>

    <!-- 3–4: every organisation -->
    {#if pack}
      <div class="all">
        {#each orgs as o (o.id)}
          <img src={avatarUrl(o.avatar, 's')} alt="" style="width:{pack.rp * 2}px;height:{pack.rp * 2}px;{orgStyle(o)}" />
        {/each}
      </div>
    {/if}
  </div>

  <div class="caption" aria-live="polite">
    {#key step}
      <div in:fade={{ duration: reduce ? 0 : 250 }}>
        <h2 id="intro-title">{fill(cap.title, stats)}</h2>
        <p>{@html fillBold(cap.text, stats)}</p>
      </div>
    {/key}
    {#if step === 0}
      <ul class="legend">
        {#each CLUSTERS as c, i}
          <li class:in={i < shown}><img src="./avatars/icon-{c}.webp" alt="" width="20" height="20" />{t.cluster[c]}</li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="controls">
    {#if step < LAST}<button class="link" onclick={close}>{t.walk.skip}</button>{:else}<span></span>{/if}
    <div class="dots">
      {#each DUR as _, i}
        <button class:on={i === step} aria-label="{t.walk.step} {i + 1}" aria-current={i === step ? 'step' : undefined} onclick={() => go(i)}></button>
      {/each}
    </div>
    <div class="nav">
      {#if step > 0}<button class="ghost" onclick={() => go(step - 1)}>‹ {t.walk.back}</button>{/if}
      {#if step < LAST}
        <button class="primary" onclick={() => go(step + 1)}>{t.walk.next} ›</button>
      {:else}
        <button class="primary" onclick={close}>{t.walk.explore}</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .scrim { position: absolute; inset: 0; z-index: 69; background: rgba(0, 63, 114, 0.18); }
  .intro {
    position: absolute; inset: 14px; z-index: 70; display: flex; flex-direction: column;
    background: #fff; border: 1px solid var(--line); border-radius: var(--radius); box-shadow: 0 16px 48px rgba(0, 30, 60, 0.18); overflow: hidden;
  }
  .intro.narrow { inset: 0; border: none; border-radius: 0; box-shadow: none; }
  .top { display: flex; align-items: center; justify-content: space-between; padding: 10px 10px 0 18px; flex: none; }
  .kicker { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b6f75; font-weight: 600; }
  .x { width: 32px; height: 32px; border-radius: var(--radius); border: 1px solid var(--line); background: #fff; color: var(--navy); cursor: pointer; font-size: 14px; }
  .x:hover { background: #F3F4F6; }

  .stage { position: relative; flex: 1 1 0; min-height: 0; margin: 4px 18px 0; overflow: hidden; }
  .narrow .stage { margin: 4px 8px 0; }

  /* scene layers share the stage and cross-fade */
  .built, .row, .counties { position: absolute; transition: opacity 0.5s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1); opacity: 0; pointer-events: none; }
  .on { opacity: 1; }

  .built { left: 50%; top: 50%; transform: translate(-50%, -50%) scale(0.9); }
  .built.on { transform: translate(-50%, -50%) scale(1); }
  /* each slice grows gently out of the centre of the avatar */
  .built img { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; transform: scale(0.55); transform-origin: 50% 50%;
    transition: opacity 0.9s ease-out, transform 1.2s cubic-bezier(0.25, 1, 0.5, 1); }
  .built img.in { opacity: 1; transform: none; }

  .row { inset: 0; display: flex; align-items: center; justify-content: center; gap: 4%; }
  .row figure { margin: 0; display: flex; flex-direction: column; align-items: center; text-align: center; max-width: 46%;
    transition: opacity 0.5s, transform 0.7s cubic-bezier(0.22, 1, 0.36, 1); opacity: 0; transform: translateY(14px) scale(0.92); }
  .row.on figure { opacity: 1; transform: none; }
  .examples img { width: min(210px, 28vw, 30vh); height: auto; aspect-ratio: 1; }
  .scale img { width: min(170px, 24vw, 26vh); height: auto; aspect-ratio: 1; }
  .row figcaption { display: flex; flex-direction: column; align-items: center; gap: 3px; margin-top: 8px; font-size: 12px; color: #33404d; }
  .row strong { font-size: 14px; color: var(--navy); }
  .cl { display: inline-flex; align-items: flex-start; gap: 5px; text-align: left; line-height: 1.3; }
  .cl i { width: 8px; height: 8px; border-radius: 50%; flex: none; margin-top: 4px; }
  .city { color: #6b6f75; font-size: 11.5px; }
  .narrow .row figcaption { font-size: 10.5px; }

  .counties { inset: 0; }
  .counties path { fill: #ECEEF1; stroke: #fff; stroke-width: 1; }
  .all { position: absolute; inset: 0; pointer-events: none; }
  .all img { position: absolute; left: 0; top: 0; transform-origin: center;
    transition: transform 1.3s cubic-bezier(0.65, 0, 0.35, 1), opacity 0.5s; }

  .caption { flex: none; padding: 10px 22px 4px; min-height: 92px; }
  .narrow .caption { padding: 8px 14px 2px; min-height: 104px; }
  h2 { margin: 0; font-size: 22px; font-weight: 800; color: var(--navy); line-height: 1.2; }
  .narrow h2 { font-size: 18px; }
  .caption p :global(strong) { color: var(--navy); font-weight: 800; }
  .caption p { margin: 4px 0 0; font-size: 14px; line-height: 1.45; color: #33404d; max-width: 640px; }
  .narrow .caption p { font-size: 13px; }
  .legend { list-style: none; margin: 10px 0 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 14px; }
  .legend li { display: flex; align-items: center; gap: 7px; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.02em; opacity: 0.2; transition: opacity 0.5s; }
  .legend li.in { opacity: 1; }
  .narrow .legend li { font-size: 9.5px; gap: 5px; }

  .controls { flex: none; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; padding: 10px 18px 14px; border-top: 1px solid var(--line); margin-top: 8px; }
  .narrow .controls { padding: 8px 10px 10px; }
  .link { justify-self: start; border: none; background: none; font: inherit; font-size: 12.5px; color: #4a5560; text-decoration: underline; cursor: pointer; padding: 4px; }
  .dots { display: flex; gap: 6px; }
  .dots button { width: 8px; height: 8px; padding: 0; border-radius: 50%; border: none; background: #D5D9DE; cursor: pointer; transition: background 0.2s, width 0.2s; }
  .dots button.on { background: var(--navy); width: 22px; border-radius: 4px; }
  .nav { justify-self: end; display: flex; gap: 6px; }
  .nav button { font: inherit; font-size: 12.5px; font-weight: 600; height: 32px; padding: 0 12px; border-radius: var(--radius); cursor: pointer; white-space: nowrap; }
  .ghost { border: 1px solid var(--line); background: #fff; color: var(--navy); }
  .primary { border: 1px solid var(--navy); background: var(--navy); color: #fff; }
  .narrow .ghost { padding: 0 9px; }

  /* reduced motion: cross-fades only */
  .reduce .built img, .reduce .row figure, .reduce .all img { transition: opacity 0.3s; transition-delay: 0ms !important; }
</style>
