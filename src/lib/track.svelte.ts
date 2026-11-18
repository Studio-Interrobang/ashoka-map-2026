/**
 * Usage analytics (Umami Cloud, cookieless, no consent banner needed).
 * Loads only on the live site, so local dev and the reel renderer are never counted.
 * Labels are always reported in English so the dashboard reads the same whatever language the visitor uses.
 */
import { untrack } from 'svelte';
import { ui } from './state.svelte';
import { t as dict } from './i18n';
import type { Org } from './types';

const WEBSITE_ID = '98042c6d-4d96-4de5-8037-fff198628021';
const LIVE_HOST = 'studio-interrobang.github.io';

type Data = Record<string, string | number | boolean>;
type Umami = { track: (event?: string | ((p: Data) => Data), data?: Data) => void };
declare global { interface Window { umami?: Umami } }

const en = dict('en');
const queue: (() => void)[] = [];
let enabled = false;

export function track(event: string, data?: Data) {
  if (!enabled) return;
  const send = () => window.umami!.track(event, data);
  if (window.umami) send(); else queue.push(send);
}

export function initTracking(getOrgs: () => Org[]) {
  if (location.hostname !== LIVE_HOST) return;
  enabled = true;
  const embedded = (() => { try { return window.self !== window.top; } catch { return true; } })();

  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://cloud.umami.is/script.js';
  s.dataset.websiteId = WEBSITE_ID;
  s.dataset.autoTrack = 'false'; // the map rewrites its URL hash constantly; one page view per visit is what we want
  s.dataset.domains = LIVE_HOST;
  s.onload = () => {
    // page view without the hash/query (the referrer still tells us which page embeds the map)
    window.umami?.track((p) => ({ ...p, url: location.pathname }));
    queue.splice(0).forEach((f) => f());
  };
  document.head.appendChild(s);

  const orgName = (id: string) => getOrgs().find((o) => o.id === id)?.short ?? id;
  track('map opened', { lang: ui.lang, embedded, view: ui.view });

  $effect.root(() => {
    // fire on changes only, not on the initial value
    const onChange = <T>(read: () => T, fire: (v: T) => void) => {
      let first = true;
      $effect(() => {
        const v = read();
        if (first) { first = false; return; }
        untrack(() => fire(v));
      });
    };
    onChange(() => ui.view, (view) => track('view', { view }));
    onChange(() => ui.lang, (lang) => track('language', { lang }));
    onChange(() => ui.groupBy, (by) => track('group clusters by', { by }));
    onChange(() => ui.lens.county, (county) => county && track('filter: county', { county }));

    // filters: report each value as it is switched on
    const added = (key: 'clusters' | 'reach' | 'activities', event: string, label: (v: string) => string) => {
      let prev = [...ui.lens[key]] as string[];
      $effect(() => {
        const now = [...ui.lens[key]] as string[];
        untrack(() => {
          now.filter((v) => !prev.includes(v)).forEach((v) => track(event, { value: label(v) }));
          prev = now;
        });
      });
    };
    added('clusters', 'filter: cluster', (c) => en.cluster[c as keyof typeof en.cluster] ?? c);
    added('reach', 'filter: scale of work', (r) => en.reach[r as keyof typeof en.reach] ?? r);
    added('activities', 'filter: activity sector', (a) => en.activity[a as keyof typeof en.activity] ?? a);

    // organisation cards (including ones opened from a shared link)
    let lastOrg: string | null = null;
    $effect(() => {
      const id = ui.selected;
      const n = getOrgs().length; // wait for data so we can name the org
      untrack(() => {
        if (!id || !n || id === lastOrg) { if (!id) lastOrg = null; return; }
        lastOrg = id;
        track('organisation opened', { org: orgName(id) });
      });
    });
  });

  // outbound links: org website / email, the report, partner logos
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a) return;
    const org = ui.selected ? orgName(ui.selected) : '';
    if (a.closest('.drawer')) {
      if (a.href.startsWith('mailto:')) track('organisation email', { org });
      else track('organisation website', { org });
    } else if (a.href.includes('docs.google.com/presentation')) track('report opened');
    else if (a.hostname !== location.hostname) track('outbound link', { to: a.hostname });
  }, true);
}
