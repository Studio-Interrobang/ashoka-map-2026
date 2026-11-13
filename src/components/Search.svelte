<script lang="ts">
  import { avatarUrl, norm } from '../lib/data';
  import { ui } from '../lib/state.svelte';
  import type { Org } from '../lib/types';
  import type { Dict } from '../lib/i18n';

  let { orgs, t }: { orgs: Org[]; t: Dict } = $props();
  let q = $state('');
  let focused = $state(false);
  let idx = $state(0);
  let results = $derived(
    q.trim().length < 2 ? [] : orgs.filter((o) => norm(`${o.short} ${o.name} ${o.uat}`).includes(norm(q))).slice(0, 8),
  );
  function pick(o: Org) { ui.selected = o.id; q = ''; focused = false; }
  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { idx = Math.min(idx + 1, results.length - 1); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { idx = Math.max(idx - 1, 0); e.preventDefault(); }
    else if (e.key === 'Enter' && results[idx]) pick(results[idx]);
    else if (e.key === 'Escape') { q = ''; }
  }
</script>

<div class="search">
  <input
    type="search" bind:value={q} placeholder={t.search} aria-label={t.search}
    role="combobox" aria-expanded={focused && results.length > 0} aria-controls="search-results"
    onfocus={() => (focused = true)} onblur={() => setTimeout(() => (focused = false), 150)}
    oninput={() => (idx = 0)} onkeydown={key}
  />
  {#if focused && q.trim().length >= 2}
    <ul id="search-results" role="listbox">
      {#each results as o, i (o.id)}
        <li role="option" aria-selected={i === idx}>
          <button class:hl={i === idx} onmousedown={() => pick(o)}>
            <img src={avatarUrl(o.avatar)} alt="" width="26" height="26" /><span><strong>{o.short}</strong><small>{o.uat}</small></span>
          </button>
        </li>
      {:else}
        <li class="none">{t.noResults}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .search { position: relative; }
  input {
    width: 100%; box-sizing: border-box; font: inherit; font-size: 13px; padding: 7px 12px 7px 32px; border-radius: var(--radius);
    border: 1px solid var(--line); background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='none' stroke='%23003F72' stroke-width='2'%3E%3Ccircle cx='6' cy='6' r='5'/%3E%3Cpath d='m10 10 3 3'/%3E%3C/svg%3E") no-repeat 11px center;
    color: var(--ink); outline: none;
  }
  input::placeholder { color: #7a8088; }
  input:focus { border-color: var(--navy); }
  ul { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 40; list-style: none; margin: 0; padding: 6px; background: #fff; border: 1px solid var(--line); border-radius: var(--radius); box-shadow: 0 8px 24px rgba(0, 30, 60, 0.12); min-width: 240px; }
  li button { display: flex; gap: 8px; align-items: center; width: 100%; padding: 6px 8px; border: none; background: none; border-radius: var(--radius-sm); cursor: pointer; text-align: left; font: inherit; color: var(--ink); }
  li button.hl, li button:hover { background: #F3F1EA; }
  li span { display: flex; flex-direction: column; font-size: 13px; }
  li small { color: #777; font-size: 11px; }
  .none { padding: 8px; color: #777; font-size: 13px; }
</style>
