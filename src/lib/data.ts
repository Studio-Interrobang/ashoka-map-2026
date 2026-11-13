import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';
import type { Dataset } from './types';

export type CountyProps = { name: string; mnemonic: string };
export type Counties = FeatureCollection<Geometry, CountyProps>;

export async function loadAll(): Promise<{ data: Dataset; counties: Counties }> {
  const [data, topo] = await Promise.all([
    fetch('./data.json').then((r) => r.json() as Promise<Dataset>),
    fetch('./geo/ro-counties.topojson').then((r) => r.json() as Promise<Topology>),
  ]);
  const obj = Object.values(topo.objects)[0] as GeometryCollection<CountyProps>;
  const counties = feature(topo, obj) as unknown as Counties;
  return { data, counties };
}

export const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const avatarUrl = (avatar: string, size: 's' | 'l' = 's') => `./avatars/${avatar}-${size}.webp`;

/** Split messy contact fields ("a@x.ro; b@y.ro", "x/ y") into valid email addresses. */
export const emails = (contact: string) =>
  contact.split(/[\s;,/]+/).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
