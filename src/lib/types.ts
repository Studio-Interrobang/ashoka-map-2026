export type Lang = 'en' | 'ro';
export type Cluster = 'C1' | 'C2' | 'C3' | 'C4';
export type Reach = 'Local' | 'National' | 'International';

export interface Org {
  id: string;
  name: string;
  short: string;
  clusters: Cluster[];
  avatar: string;
  reach: Reach;
  year: number | null;
  audience: string;
  desc: Record<Lang, string>;
  website: string;
  contact: string;
  county: string;
  uat: string;
  lat: number;
  lon: number;
  activities: string[];
  outcomes: string[];
}

export interface Dataset {
  updated: string;
  count: number;
  orgs: Org[];
}

export type Variant = 'zoom' | 'bloom' | 'choropleth' | 'dorling' | 'universe';
export type GroupBy = 'none' | 'reach' | 'cluster' | 'county' | 'decade';

export interface Lens {
  clusters: Cluster[];
  reach: Reach[];
  activities: string[];
  county: string;
}

export const CLUSTER_COLORS: Record<Cluster, string> = {
  C1: '#003F72',
  C2: '#0088CE',
  C3: '#008770',
  C4: '#E98300',
};
export const CLUSTERS: Cluster[] = ['C1', 'C2', 'C3', 'C4'];
export const REACHES: Reach[] = ['Local', 'National', 'International'];
export const ACTIVITIES = ['mobilisation', 'civic_ed', 'advocacy', 'research', 'watchdog', 'media', 'legal'];
