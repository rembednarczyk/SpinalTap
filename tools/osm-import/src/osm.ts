/**
 * OpenStreetMap data of the importer: parsing the API's XML, the compact extract kept in
 * `data/osm/` (metadata dropped, only what the generator reads) and merging tiles.
 */

export type Tags = Readonly<Record<string, string>>;

export interface OsmNode {
  readonly id: number;
  readonly lat: number;
  readonly lon: number;
  readonly tags?: Tags;
}

export interface OsmWay {
  readonly id: number;
  readonly nodes: readonly number[];
  readonly tags?: Tags;
}

export interface OsmMember {
  readonly type: "node" | "way" | "relation";
  readonly ref: number;
  readonly role: string;
}

export interface OsmRelation {
  readonly id: number;
  readonly members: readonly OsmMember[];
  readonly tags?: Tags;
}

export interface OsmData {
  readonly nodes: ReadonlyMap<number, OsmNode>;
  readonly ways: ReadonlyMap<number, OsmWay>;
  readonly relations: ReadonlyMap<number, OsmRelation>;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const decode = (s: string): string =>
  s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-z]+);/g, (m, e: string) => {
    if (e.startsWith("#x")) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (e.startsWith("#")) return String.fromCodePoint(parseInt(e.slice(1), 10));
    return ENTITIES[e] ?? m;
  });

const attrs = (s: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(/([\w:]+)="([^"]*)"/g)) out[m[1]!] = decode(m[2]!);
  return out;
};

/** Parses the XML of `/api/0.6/map` (one element or child per line, as the API writes it). */
export const parseOsmXml = (xml: string): OsmData => {
  const nodes = new Map<number, OsmNode>();
  const ways = new Map<number, OsmWay>();
  const relations = new Map<number, OsmRelation>();
  type Open = { kind: "node" | "way" | "relation"; a: Record<string, string>; tags: Record<string, string>; nds: number[]; members: OsmMember[] };
  let cur: Open | null = null;
  const close = (o: Open) => {
    const tags = Object.keys(o.tags).length > 0 ? { tags: o.tags } : {};
    const id = Number(o.a.id);
    if (o.kind === "node") nodes.set(id, { id, lat: Number(o.a.lat), lon: Number(o.a.lon), ...tags });
    else if (o.kind === "way") ways.set(id, { id, nodes: o.nds, ...tags });
    else relations.set(id, { id, members: o.members, ...tags });
  };
  for (const m of xml.matchAll(/<(\/?)(node|way|relation|tag|nd|member)\b([^>]*?)(\/?)>/g)) {
    const [, closing, name, body, selfClose] = m as unknown as [string, string, string, string, string];
    if (closing) {
      if (cur) close(cur);
      cur = null;
      continue;
    }
    if (name === "node" || name === "way" || name === "relation") {
      const o: Open = { kind: name, a: attrs(body), tags: {}, nds: [], members: [] };
      if (selfClose) close(o);
      else cur = o;
      continue;
    }
    if (!cur) continue;
    const a = attrs(body);
    if (name === "tag" && a.k !== undefined && a.v !== undefined) cur.tags[a.k] = a.v;
    else if (name === "nd") cur.nds.push(Number(a.ref));
    else if (name === "member") cur.members.push({ type: a.type as OsmMember["type"], ref: Number(a.ref), role: a.role ?? "" });
  }
  return { nodes, ways, relations };
};

/** Keys whose elements the generator reads. */
const AREA_OR_LINE_KEYS = [
  "building",
  "highway",
  "area:highway",
  "landuse",
  "leisure",
  "natural",
  "water",
  "waterway",
  "place",
  "amenity",
  "railway",
  "man_made",
  "historic",
  "tourism",
  "bridge",
];
const POI_KEYS = ["shop", "amenity", "tourism", "historic", "public_transport", "highway", "leisure", "office", "craft"];
/** Tags without use to the game, dropped from the extract. */
const DROP_TAG = /^(note|fixme|FIXME|source|image|url|website|wikimedia_commons|phone|email|contact:|opening_hours|check_date|description|mapillary|survey|operator:wikidata|brand:wikidata|ref:|payment:|fax|level:ref)/;

const cleanTags = (tags: Tags | undefined): Tags | undefined => {
  if (!tags) return undefined;
  const out: Record<string, string> = {};
  for (const k of Object.keys(tags).sort()) if (!DROP_TAG.test(k)) out[k] = tags[k]!;
  return Object.keys(out).length > 0 ? out : undefined;
};

/** The tags of a crossing or traffic lights node the generator reads. */
const crossingTags = (tags: Tags): Tags => {
  const out: Record<string, string> = {};
  for (const k of ["crossing", "crossing:markings", "highway", "traffic_signals:direction"]) if (tags[k] !== undefined) out[k] = tags[k]!;
  return out;
};

const keeps = (tags: Tags | undefined, keys: readonly string[]): boolean => !!tags && keys.some((k) => tags[k] !== undefined);

/** Only what the generator reads: map features, multipolygons, their nodes and named points of interest. */
export const filterOsm = (data: OsmData): OsmData => {
  const relations = new Map<number, OsmRelation>();
  const wayIds = new Set<number>();
  for (const r of data.relations.values()) {
    const t = r.tags?.type;
    if (t !== "multipolygon" && t !== "building") continue;
    const tags = cleanTags(r.tags);
    relations.set(r.id, { id: r.id, members: r.members.filter((m) => m.type === "way"), ...(tags ? { tags } : {}) });
    for (const m of r.members) if (m.type === "way") wayIds.add(m.ref);
  }
  const ways = new Map<number, OsmWay>();
  const nodeIds = new Set<number>();
  for (const w of data.ways.values()) {
    if (!wayIds.has(w.id) && !keeps(w.tags, AREA_OR_LINE_KEYS)) continue;
    const tags = cleanTags(w.tags);
    ways.set(w.id, { id: w.id, nodes: w.nodes, ...(tags ? { tags } : {}) });
    for (const n of w.nodes) nodeIds.add(n);
  }
  const nodes = new Map<number, OsmNode>();
  for (const n of data.nodes.values()) {
    const poi = n.tags?.name !== undefined && keeps(n.tags, POI_KEYS);
    if (!poi && !nodeIds.has(n.id)) continue;
    // A way's node keeps only its crossing and traffic light tags: zebras and stop lines are drawn from them.
    const tags = poi ? cleanTags(n.tags) : n.tags?.highway === "crossing" || n.tags?.highway === "traffic_signals" ? crossingTags(n.tags) : undefined;
    nodes.set(n.id, { id: n.id, lat: n.lat, lon: n.lon, ...(tags ? { tags } : {}) });
  }
  return { nodes, ways, relations };
};

export const mergeOsm = (parts: readonly OsmData[]): OsmData => {
  const nodes = new Map<number, OsmNode>();
  const ways = new Map<number, OsmWay>();
  const relations = new Map<number, OsmRelation>();
  for (const p of parts) {
    for (const n of p.nodes.values()) nodes.set(n.id, n);
    for (const w of p.ways.values()) ways.set(w.id, w);
    for (const r of p.relations.values()) {
      // A relation cut by a tile edge lists all its members in every tile, so any copy will do.
      relations.set(r.id, r);
    }
  }
  return { nodes, ways, relations };
};

const byId = <T extends { readonly id: number }>(m: ReadonlyMap<number, T>): T[] => [...m.values()].sort((a, b) => a.id - b.id);

/** The extract file: one element per line, sorted by id, so refetches diff cleanly. */
export const serializeOsm = (data: OsmData, header: Record<string, unknown>): string => {
  const lines: string[] = [];
  const t = (tags: Tags | undefined) => (tags ? `,${JSON.stringify(tags)}` : "");
  for (const n of byId(data.nodes)) lines.push(`[${n.id},${n.lat},${n.lon}${t(n.tags)}]`);
  const ways = byId(data.ways).map((w) => `[${w.id},${JSON.stringify(w.nodes)}${t(w.tags)}]`);
  const rels = byId(data.relations).map((r) => `[${r.id},${JSON.stringify(r.members.map((m) => [m.type[0], m.ref, m.role]))}${t(r.tags)}]`);
  return `{"header":${JSON.stringify(header)},\n"nodes":[\n${lines.join(",\n")}\n],\n"ways":[\n${ways.join(",\n")}\n],\n"relations":[\n${rels.join(",\n")}\n]}\n`;
};

type RawNode = [number, number, number, Tags?];
type RawWay = [number, number[], Tags?];
type RawRelation = [number, [string, number, string][], Tags?];

export const parseExtract = (json: string): OsmData => {
  const raw = JSON.parse(json) as { nodes: RawNode[]; ways: RawWay[]; relations: RawRelation[] };
  const type = (c: string): OsmMember["type"] => (c === "n" ? "node" : c === "w" ? "way" : "relation");
  return {
    nodes: new Map(raw.nodes.map(([id, lat, lon, tags]) => [id, { id, lat, lon, ...(tags ? { tags } : {}) }])),
    ways: new Map(raw.ways.map(([id, nodes, tags]) => [id, { id, nodes, ...(tags ? { tags } : {}) }])),
    relations: new Map(
      raw.relations.map(([id, members, tags]) => [id, { id, members: members.map(([t, ref, role]) => ({ type: type(t), ref, role })), ...(tags ? { tags } : {}) }]),
    ),
  };
};
