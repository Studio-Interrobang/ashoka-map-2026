<script lang="ts">
  import { avatarUrl, emails } from '../lib/data';
  import { ui } from '../lib/state.svelte';
  import { CLUSTER_COLORS, type Org } from '../lib/types';
  import type { Dict } from '../lib/i18n';

  let { org, t }: { org: Org; t: Dict } = $props();
  let closeBtn: HTMLButtonElement | undefined = $state();
  $effect(() => { org; closeBtn?.focus(); });
  const host = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (ui.selected = null)} />

<div class="scrim" onclick={() => (ui.selected = null)} aria-hidden="true"></div>
<div class="panel" role="dialog" aria-modal="false" aria-labelledby="org-title">
  <button class="close" bind:this={closeBtn} onclick={() => (ui.selected = null)} aria-label={t.detail.close}>✕</button>
  <div class="head">
    <img src={avatarUrl(org.avatar, 'l')} alt="" width="150" height="150" />
    <h2 id="org-title">{org.short}</h2>
    {#if org.name !== org.short}<p class="official">{org.name}</p>{/if}
    <ul class="clusters">
      {#each org.clusters as c}<li><span class="dot" style="background:{CLUSTER_COLORS[c]}"></span>{t.cluster[c]}</li>{/each}
    </ul>
  </div>
  {#if org.desc[ui.lang]}<p class="desc">{org.desc[ui.lang]}</p>{/if}
  <dl>
    <div><dt>{t.detail.location}</dt><dd>{org.uat}{org.county && org.county !== org.uat ? `, ${org.county}` : ''}</dd></div>
    <div><dt>{t.detail.reach}</dt><dd>{t.reach[org.reach]}</dd></div>
    {#if org.year}<div><dt>{t.detail.founded}</dt><dd>{org.year}</dd></div>{/if}
    {#if org.audience}<div class="wide"><dt>{t.detail.audience}</dt><dd>{org.audience}</dd></div>{/if}
  </dl>
  {#if org.activities.length}
    <h3>{t.detail.activities}</h3>
    <div class="tags">{#each org.activities as a}<span>{t.activity[a as keyof typeof t.activity]}</span>{/each}</div>
  {/if}
  {#if org.outcomes.length}
    <h3>{t.detail.outcomes}</h3>
    <div class="tags light">{#each org.outcomes as a}<span>{t.outcome[a as keyof typeof t.outcome]}</span>{/each}</div>
  {/if}
  <div class="links">
    {#if org.website}<a href={org.website} target="_blank" rel="noopener">{host(org.website)} ↗</a>{/if}
    {#each emails(org.contact) as e}<a href="mailto:{e}">{e}</a>{/each}
  </div>
</div>

<style>
  .scrim { position: absolute; inset: 0; z-index: 29; background: transparent; }
  .panel {
    position: absolute; top: 10px; right: 10px; bottom: 10px; width: min(340px, calc(100% - 20px)); z-index: 30;
    background: #fff; border: 1px solid var(--line); border-radius: var(--radius); box-shadow: 0 10px 30px rgba(0, 30, 60, 0.14); padding: 18px 18px 16px;
    overflow: auto; animation: slide 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes slide { from { transform: translateX(24px); opacity: 0; } }
  .close { position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; border-radius: var(--radius); border: none; background: #F1F2F4; cursor: pointer; color: var(--navy); }
  .head { text-align: center; }
  .head img { display: block; margin: 4px auto 6px; }
  h2 { margin: 0; font-size: 20px; font-weight: 800; color: var(--navy); line-height: 1.2; }
  .official { margin: 4px 0 0; font-size: 12px; color: #666; }
  .clusters { list-style: none; padding: 0; margin: 10px 0 0; display: flex; flex-direction: column; gap: 3px; align-items: center; }
  .clusters li { font-size: 12px; display: flex; align-items: center; gap: 6px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; }
  .desc { font-size: 14px; line-height: 1.45; margin: 14px 0 6px; }
  dl { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; }
  dl .wide { grid-column: 1 / -1; }
  dt { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #777; }
  dd { margin: 2px 0 0; font-size: 13.5px; font-weight: 600; }
  h3 { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #777; margin: 14px 0 6px; font-weight: 600; }
  .tags { display: flex; flex-wrap: wrap; gap: 5px; }
  .tags span { font-size: 12px; padding: 3px 8px; border-radius: var(--radius-sm); background: var(--navy); color: #fff; }
  .tags.light span { background: #EEF4F8; color: var(--navy); }
  .links { display: flex; flex-direction: column; gap: 6px; margin-top: 16px; border-top: 1px solid #eee; padding-top: 12px; }
  .links a { color: var(--navy); font-weight: 600; font-size: 13px; word-break: break-all; }
  @media (max-width: 560px) {
    .scrim { background: rgba(0, 20, 40, 0.35); }
    .panel { top: auto; left: 0; right: 0; bottom: 0; width: auto; max-height: 82%; border-radius: var(--radius) var(--radius) 0 0; animation-name: up; }
    @keyframes up { from { transform: translateY(40px); opacity: 0; } }
  }
</style>
