<script lang="ts">
  import { avatarUrl } from '../lib/data';
  import { CLUSTER_COLORS, type Org } from '../lib/types';

  let { org, r, detailed = false }: { org: Org; r: number; detailed?: boolean } = $props();

  // Simplified badge for small sizes: warm-grey disc + cluster-coloured ring sectors.
  function arc(r0: number, r1: number, a0: number, a1: number) {
    const p = (rad: number, a: number) => `${rad * Math.sin(a)},${-rad * Math.cos(a)}`;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    if (a1 - a0 >= Math.PI * 2 - 1e-6) {
      return `M${p(r1, 0)}A${r1},${r1} 0 1 1 ${p(r1, Math.PI)}A${r1},${r1} 0 1 1 ${p(r1, 0)}M${p(r0, 0)}A${r0},${r0} 0 1 0 ${p(r0, Math.PI)}A${r0},${r0} 0 1 0 ${p(r0, 0)}Z`;
    }
    return `M${p(r1, a0)}A${r1},${r1} 0 ${large} 1 ${p(r1, a1)}L${p(r0, a1)}A${r0},${r0} 0 ${large} 0 ${p(r0, a0)}Z`;
  }
  const reachScale = { Local: 0.78, National: 0.9, International: 1 } as const;
  let sectors = $derived.by(() => {
    const n = org.clusters.length;
    const outer = r * reachScale[org.reach];
    return org.clusters.map((c, i) => ({
      d: arc(r * 0.42, outer, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2),
      fill: CLUSTER_COLORS[c],
    }));
  });
</script>

{#if detailed && r >= 9}
  <image href={avatarUrl(org.avatar, r > 26 ? 'l' : 's')} x={-r} y={-r} width={r * 2} height={r * 2} />
{:else}
  <circle r={r * 0.92} fill="#DAD7CB" />
  {#each sectors as s}<path d={s.d} fill={s.fill} fill-rule="evenodd" />{/each}
  <circle r={r * 0.38} fill="#fff" />
{/if}
<circle class="hit" r={r} fill="transparent" />
