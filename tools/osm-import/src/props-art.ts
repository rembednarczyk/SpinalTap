/**
 * The shape of a monument or an artwork (ADR-0047, G-149): from the hand table of Lublin's known
 * monuments, else from the OSM tags of its node (`memorial`, `artwork_type`, `historic`, `name`),
 * else the neutral stele. Never from the hash of its id: a stack of cubes or a figure on a plinth
 * in place of a plaque, a mural or a Koziołek was the glitch. What is not free-standing (plaques,
 * murals, stumbling stones) is left out with a reason.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DISTRICTS } from "./config.ts";
import { type Tags, mergeOsm, parseExtract } from "./osm.ts";
import { REPO } from "./paths.ts";
import type { SKIPPED_ART } from "./props-kinds.ts";

/** The renderer's monument shapes (`MONUMENT_SHAPE`), the low bits of `variant`. */
export const ART_SHAPE = { obelisk: 0, figure: 1, koziolek: 2, abstract: 3, stele: 4, shrine: 5 } as const;
export type ArtShape = keyof typeof ART_SHAPE;

/** A monument or artwork: its shape, or why it is not a free-standing piece (`SKIPPED_ART`). */
export type ArtPick = { readonly shape: ArtShape } | { readonly skip: keyof typeof SKIPPED_ART };

/**
 * Lublin's monuments and artworks in the game's chunks, by OSM id: the shape the real thing is
 * nearest to, where the tags say too little or mislead (a block tagged `statue`, a lion, a model
 * of a church), and the tags of four nodes missing from `data/osm` (OSM API, 1.11.2026).
 */
export const KNOWN_ART: Readonly<Record<string, { readonly name: string; readonly pick: ArtPick }>> = {
  // Plac Litewski and Krakowskie Przedmieście.
  n481952879: { name: "Pomnik Unii Lubelskiej", pick: { shape: "obelisk" } },
  // Equestrian in truth; its own shape is G-128.
  n481952877: { name: "Pomnik Józefa Piłsudskiego", pick: { shape: "figure" } },
  // A rough stone block with the dates and an eagle, no figure (`memorial=statue` notwithstanding).
  n481952880: { name: "Pomnik Konstytucji 3 Maja", pick: { shape: "stele" } },
  n481952881: { name: "Grób Nieznanego Żołnierza", pick: { shape: "stele" } },
  n481952873: { name: "Pomnik Józefa Czechowicza", pick: { shape: "stele" } },
  n8289475905: { name: "I love Lublin", pick: { shape: "stele" } },
  n10260037968: { name: "Portal Wilno-Lublin", pick: { shape: "stele" } },
  n9268852964: { name: "Makieta Lublina", pick: { shape: "stele" } },
  n13208582557: { name: "Konik na biegunach", pick: { shape: "stele" } },
  n10803415138: { name: "(statue, missing from data/osm)", pick: { shape: "figure" } },
  n11340871032: { name: "(graffiti, missing from data/osm)", pick: { skip: "graffiti" } },
  // Stare Miasto.
  n3020699255: { name: "Pomnik kard. Stefana Wyszyńskiego", pick: { shape: "figure" } },
  n7168903380: { name: "Sztukmistrz z Lublina na linie", pick: { skip: "rope" } },
  n4848011149: { name: "Model fary św. Michała", pick: { shape: "stele" } },
  n9382021599: { name: "Neon „Przypadek? Nie sądzę!”", pick: { skip: "neon" } },
  n9796264686: { name: "(mural, untagged in data/osm)", pick: { skip: "mural" } },
  // Podzamcze.
  n814815676: { name: "Pomnik Lwa Lwowskiego", pick: { shape: "stele" } },
  n814815673: { name: "Pomnik Pamięci Żołnierzy AK-WiN", pick: { shape: "stele" } },
  n9418104831: { name: "(statue, missing from data/osm)", pick: { shape: "figure" } },
};

const FIGURES = new Set(["statue", "bust"]);
const FLAT: ReadonlySet<string> = new Set<keyof typeof SKIPPED_ART>(["plaque", "stolperstein", "mural", "graffiti", "mosaic", "relief"]);
const isFlat = (v: string | undefined): v is keyof typeof SKIPPED_ART => v !== undefined && FLAT.has(v);

/** Picks a monument's or an artwork's shape: the hand table, the tags, then the neutral stele. */
export const artShape = (id: string, tags: Tags | undefined, kind = ""): ArtPick => {
  const known = KNOWN_ART[id];
  if (known) return known.pick;
  const t = tags ?? {};
  const flat = [t.memorial, t.artwork_type].find(isFlat);
  if (flat) return { skip: flat };
  if (/kozio/i.test(t.name ?? "")) return { shape: "koziolek" };
  if (t.memorial === "obelisk" || /obelisk/i.test(t.name ?? "")) return { shape: "obelisk" };
  if (FIGURES.has(t.memorial ?? "") || FIGURES.has(t.artwork_type ?? "")) return { shape: "figure" };
  if (t.historic === "wayside_shrine" || t.historic === "wayside_cross" || t.memorial === "cross" || kind === "shrine") return { shape: "shrine" };
  // A sculpture with no figure in its tags; one with a figure is in the table.
  if (t.artwork_type === "sculpture") return { shape: "abstract" };
  return { shape: "stele" };
};

/** OSM tags of every node by id (`n123`), from the committed extracts: offline. */
export const loadNodeTags = (root = REPO): ReadonlyMap<string, Tags> => {
  const osm = mergeOsm(DISTRICTS.map((d) => parseExtract(readFileSync(join(root, "data/osm", `${d.slug}.json`), "utf8"))));
  const out = new Map<string, Tags>();
  for (const n of osm.nodes.values()) if (n.tags) out.set(`n${n.id}`, n.tags);
  return out;
};
