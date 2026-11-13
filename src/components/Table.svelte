<script lang="ts">
  import { avatarUrl } from '../lib/data';
  import { ui, matches } from '../lib/state.svelte';
  import { CLUSTER_COLORS, REACHES, type Org } from '../lib/types';
  import type { Dict } from '../lib/i18n';

  let { orgs, t }: { orgs: Org[]; t: Dict } = $props();
  type SortKey = 'short' | 'uat' | 'reach';
  let sortKey = $state<SortKey>('short');
  let asc = $state(true);

  let rows = $derived.by(() => {
    const list = orgs.filter((o) => matches(o, ui.lens));
    const val = (o: Org) => (sortKey === 'reach' ? REACHES.indexOf(o.reach) : o[sortKey]);
    return list.sort((a, b) => {
      const x = val(a); const y = val(b);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ro');
      return asc ? c : -c;
    });
  });
  function sort(k: SortKey) { if (sortKey === k) asc = !asc; else { sortKey = k; asc = true; } }
  const aria = (k: SortKey) => (sortKey === k ? (asc ? 'ascending' : 'descending') : 'none');
</script>

<div class="wrap">
  <table>
    <thead>
      <tr>
        <th aria-sort={aria('short')}><button onclick={() => sort('short')}>{t.col.org}</button></th>
        <th aria-sort={aria('uat')} class="hide-s"><button onclick={() => sort('uat')}>{t.col.location}</button></th>
        <th class="hide-s">{t.col.clusters}</th>
        <th aria-sort={aria('reach')}><button onclick={() => sort('reach')}>{t.col.reach}</button></th>
      </tr>
    </thead>
    <tbody>
      {#each rows as o (o.id)}
        <tr class:sel={ui.selected === o.id} onclick={() => (ui.selected = o.id)}>
          <td>
            <div class="org">
              <img src={avatarUrl(o.avatar)} alt="" width="40" height="40" loading="lazy" />
              <div>
                <button class="name" onclick={(e) => { e.stopPropagation(); ui.selected = o.id; }}>{o.short}</button>
                <div class="desc">{o.desc[ui.lang]}</div>
                <div class="show-s meta">{o.uat}</div>
              </div>
            </div>
          </td>
          <td class="hide-s">{o.uat}<div class="sub">{o.county !== o.uat ? o.county : ''}</div></td>
          <td class="hide-s">
            {#each o.clusters as c}<div class="cl"><span class="dot" style="background:{CLUSTER_COLORS[c]}"></span>{t.cluster[c]}</div>{/each}
          </td>
          <td>{t.reach[o.reach]}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .wrap { height: 100%; overflow: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  /* the rule is a box-shadow so it stays under every header cell, sticky or not */
  thead th { position: sticky; top: 0; background: #fff; z-index: 1; text-align: left; padding: 0; box-shadow: inset 0 -2px 0 var(--navy); }
  th button, th:not(:has(button)) { font: inherit; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--navy); font-weight: 700; padding: 10px 8px; }
  th button { background: none; border: none; cursor: pointer; }
  th[aria-sort='ascending'] button::after { content: ' ↑'; }
  th[aria-sort='descending'] button::after { content: ' ↓'; }
  td { padding: 8px; border-bottom: 1px solid #ECEEF1; vertical-align: top; }
  tr { cursor: pointer; }
  tbody tr:hover, tr.sel { background: #F5F6F8; }
  .org { display: flex; gap: 10px; align-items: flex-start; }
  .org img { flex: none; }
  .name { font: inherit; font-weight: 700; color: var(--navy); background: none; border: none; padding: 0; cursor: pointer; text-align: left; font-size: 14px; }
  .desc { color: #555; font-size: 12.5px; margin-top: 2px; }
  .sub { color: #888; font-size: 11.5px; }
  .cl { display: flex; align-items: flex-start; gap: 5px; font-size: 12px; line-height: 1.3; margin-bottom: 3px; } .cl .dot { margin-top: 4px; flex: none; }
  .dot { width: 8px; height: 8px; border-radius: 50%; }
  .show-s { display: none; }
  .meta { color: #888; font-size: 11.5px; }
  @media (max-width: 560px) { .hide-s { display: none; } .show-s { display: block; } }
</style>
