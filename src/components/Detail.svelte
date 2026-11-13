<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { avatarUrl, emails } from '../lib/data';
  import { ui } from '../lib/state.svelte';
  import { CLUSTER_COLORS, type Org } from '../lib/types';
  import type { Dict } from '../lib/i18n';

  let { org, t, narrow = false }: { org: Org; t: Dict; narrow?: boolean } = $props();
  let closeBtn: HTMLButtonElement | undefined = $state();
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // remember what opened the drawer, and give focus back on close
  onMount(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus?.();
  });
  $effect(() => { org; closeBtn?.focus(); });
  const close = () => (ui.selected = null);
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

{#if !narrow}<div class="scrim" onclick={close} aria-hidden="true" transition:fade={{ duration: reduce ? 0 : 160 }}></div>{/if}
<div
  class="drawer"
  class:sheet={narrow}
  role="dialog"
  aria-modal="true"
  aria-labelledby="org-title"
  transition:fly={narrow ? { y: 600, duration: reduce ? 0 : 260, easing: cubicOut, opacity: 1 } : { x: 420, duration: reduce ? 0 : 240, easing: cubicOut, opacity: 1 }}
>
  <div class="bar">
    <span class="kicker">{t.cluster[org.clusters[0]]}{org.clusters.length > 1 ? ` +${org.clusters.length - 1}` : ''}</span>
    <button class="close" bind:this={closeBtn} onclick={close} aria-label={t.detail.close}>✕</button>
  </div>

  {#key org.id}
    <div class="body" in:fade={{ duration: reduce ? 0 : 120 }}>
      <section class="head">
        <img src={avatarUrl(org.avatar, 'l')} alt="" width="120" height="120" />
        <div>
          <h2 id="org-title">{org.short}</h2>
          {#if org.name !== org.short}<p class="official">{org.name}</p>{/if}
        </div>
      </section>
      <section>
        <ul class="clusters">
          {#each org.clusters as c}<li><span class="dot" style="background:{CLUSTER_COLORS[c]}"></span>{t.cluster[c]}</li>{/each}
        </ul>
      </section>
      {#if org.desc[ui.lang]}
        <section><h3>{t.detail.about}</h3><p class="desc">{org.desc[ui.lang]}</p></section>
      {/if}
      <section>
        <dl>
          <div><dt>{t.detail.location}</dt><dd>{org.uat}{org.county && org.county !== org.uat ? `, ${org.county}` : ''}</dd></div>
          <div><dt>{t.detail.reach}</dt><dd>{t.reach[org.reach]}</dd></div>
          {#if org.year}<div><dt>{t.detail.founded}</dt><dd>{org.year}</dd></div>{/if}
          {#if org.audience}<div class="wide"><dt>{t.detail.audience}</dt><dd>{org.audience}</dd></div>{/if}
        </dl>
      </section>
      {#if org.activities.length}
        <section>
          <h3>{t.detail.activities}</h3>
          <div class="tags">{#each org.activities as a}<span>{t.activity[a as keyof typeof t.activity]}</span>{/each}</div>
        </section>
      {/if}
      {#if org.outcomes.length}
        <section>
          <h3>{t.detail.outcomes}</h3>
          <div class="tags light">{#each org.outcomes as a}<span>{t.outcome[a as keyof typeof t.outcome]}</span>{/each}</div>
        </section>
      {/if}
    </div>
  {/key}

  {#if org.website || emails(org.contact).length}
    <div class="links">
      <span class="lbl">{t.detail.contact}</span>
      {#if org.website}<a class="btn" href={org.website} target="_blank" rel="noopener">{t.detail.website} ↗</a>{/if}
      {#each emails(org.contact) as e}<a href="mailto:{e}">{e}</a>{/each}
    </div>
  {/if}
</div>

<style>
  .scrim { position: absolute; inset: 0; z-index: 49; background: rgba(0, 63, 114, 0.14); }
  .drawer {
    position: absolute; top: 0; right: 0; bottom: 0; width: min(400px, 52%); z-index: 50;
    display: flex; flex-direction: column; background: #fff;
    border-left: 1px solid var(--line); box-shadow: -12px 0 32px rgba(0, 30, 60, 0.12);
  }
  :global(.wide) .drawer { width: min(420px, 45%); }
  .drawer.sheet { width: 100%; left: 0; border-left: none; box-shadow: none; }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 44px; flex: none; padding: 0 8px 0 20px; border-bottom: 1px solid var(--line); }
  .kicker { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b6f75; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .close { width: 32px; height: 32px; flex: none; border-radius: var(--radius); border: 1px solid var(--line); background: #fff; cursor: pointer; color: var(--navy); font-size: 14px; }
  .sheet .close { width: 44px; height: 44px; }
  .close:hover { background: #F3F4F6; }
  .body { flex: 1; overflow: auto; padding: 4px 20px 12px; }
  /* sections separated by thin rules */
  section { padding: 18px 0; }
  section + section { border-top: 1px solid var(--line); }
  .head { display: flex; gap: 14px; align-items: center; }
  .head img { flex: none; }
  h2 { margin: 0; font-size: 20px; font-weight: 800; color: var(--navy); line-height: 1.2; }
  .official { margin: 4px 0 0; font-size: 12px; color: #6b6f75; }
  .clusters { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .clusters li { font-size: 13px; display: flex; align-items: center; gap: 7px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
  .desc { font-size: 14px; line-height: 1.55; margin: 0; }
  .lbl { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b6f75; font-weight: 600; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 12px; margin: 0; }
  dl .wide { grid-column: 1 / -1; }
  dt { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b6f75; }
  dd { margin: 3px 0 0; font-size: 13.5px; font-weight: 600; }
  h3 { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b6f75; margin: 0 0 8px; font-weight: 600; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .tags span { font-size: 12px; padding: 3px 8px; border-radius: var(--radius-sm); background: var(--navy); color: #fff; }
  .tags.light span { background: #EEF2F6; color: var(--navy); }
  .links { flex: none; display: flex; flex-direction: column; gap: 8px; padding: 14px 20px 16px; border-top: 1px solid var(--line); background: #fff; }
  .links a { color: var(--navy); font-weight: 600; font-size: 13px; word-break: break-all; }
  .links a.btn { display: block; text-align: center; background: var(--navy); color: #fff; padding: 8px 10px; border-radius: var(--radius); text-decoration: none; word-break: normal; }
</style>
