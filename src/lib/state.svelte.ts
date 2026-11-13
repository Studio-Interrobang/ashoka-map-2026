import type { Cluster, GroupBy, Lang, Lens, Org, Reach, Variant } from './types';

const VARIANTS: Variant[] = ['zoom', 'bloom', 'choropleth', 'dorling', 'universe'];

function readParams() {
  const p = new URLSearchParams(location.search);
  const h = new URLSearchParams(location.hash.slice(1));
  const get = (k: string) => h.get(k) ?? p.get(k);
  const lang = get('lang') === 'ro' ? 'ro' : get('lang') === 'en' ? 'en' : navigator.language.startsWith('ro') ? 'ro' : 'en';
  const v = get('map') as Variant;
  return {
    lang: lang as Lang,
    view: (get('view') === 'table' ? 'table' : 'map') as 'map' | 'table',
    variant: VARIANTS.includes(v) ? v : ('bloom' as Variant),
    selected: get('org'),
    lab: p.get('lab') === '1',
  };
}

const init = readParams();

export const ui = $state({
  lang: init.lang,
  view: init.view,
  variant: init.variant,
  groupBy: 'reach' as GroupBy,
  selected: init.selected as string | null,
  hovered: null as string | null,
  lab: init.lab,
  lens: { clusters: [], reach: [], activities: [], county: '' } as Lens,
});

export function lensActive(l: Lens) {
  return l.clusters.length + l.reach.length + l.activities.length + (l.county ? 1 : 0) > 0;
}

export function matches(o: Org, l: Lens) {
  if (l.clusters.length && !l.clusters.some((c) => o.clusters.includes(c))) return false;
  if (l.reach.length && !l.reach.includes(o.reach)) return false;
  if (l.activities.length && !l.activities.some((a) => o.activities.includes(a))) return false;
  if (l.county && o.county !== l.county) return false;
  return true;
}

export function toggle<T extends Cluster | Reach | string>(arr: T[], v: T) {
  const i = arr.indexOf(v);
  if (i >= 0) arr.splice(i, 1);
  else arr.push(v);
}

export function clearLens() {
  ui.lens.clusters.length = 0;
  ui.lens.reach.length = 0;
  ui.lens.activities.length = 0;
  ui.lens.county = '';
}

/** Mirror state into the URL hash so links are shareable (works inside the iframe too). */
export function syncUrl() {
  const h = new URLSearchParams();
  h.set('lang', ui.lang);
  if (ui.view !== 'map') h.set('view', ui.view);
  if (ui.lab) h.set('map', ui.variant);
  if (ui.selected) h.set('org', ui.selected);
  history.replaceState(null, '', '#' + h.toString());
}
