import { PROTECTED_AREAS } from "../../../packages/engine/src/renderer/mapcity/skyline-protected";
import { type P2, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { METRO_PLANNED, METRO_TUNNEL, metroStation } from "../../../packages/sim/src/content/metro";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { loadBuildingTags } from "../../osm-import/src/props-art.ts";

/**
 * The metro line on the map (ADR-0071) against what it may not run under (G-314, G-315): the
 * tunnel and the dashed lines of the possible stations, sampled every 5 m, outside the protected
 * areas of the skyline (the Jewish cemeteries, Ogród Saski) and outside the outline of any
 * historic, heritage or church building (a place of worship). One finding per line and place.
 */

const STEP = 5;
const PROTECTED_USES: ReadonlySet<string> = new Set(["historic", "church"]);

export interface MetroLineFinding {
  readonly line: string;
  readonly what: string;
  readonly x: number;
  readonly z: number;
}

const ring = (flat: readonly number[], dx = 0, dz = 0): P2[] => {
  const out: P2[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i]! + dx, z: flat[i + 1]! + dz });
  return out;
};

const sample = (points: readonly P2[]): P2[] => {
  const out: P2[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / STEP));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  return out;
};

/** The lines of the map: each tunnel between its stations' kiosks, each possible station's branch. */
export const metroLines = (): { readonly name: string; readonly points: readonly P2[] }[] => [
  ...METRO_TUNNEL.map((t) => ({ name: `tunnel ${t.from}-${t.to}`, points: [metroStation(t.from).kiosk, ...t.via, metroStation(t.to).kiosk] })),
  ...METRO_PLANNED.filter((p) => !p.onLine).map((p) => ({ name: `planned ${p.id}`, points: [metroStation(p.from).kiosk, ...p.via, p.at] })),
];

export const metroLineProtected = (lines = metroLines()): MetroLineFinding[] => {
  const tags = loadBuildingTags();
  const keep = [
    ...PROTECTED_AREAS.map((a) => ({ what: `${a.name} ${a.osm}`, ring: ring(a.ring) })),
    ...MAP_CHUNKS.flatMap((c) =>
      c.buildings
        .filter((b) => {
          const t = tags.get(b.id.split("/")[0]!) ?? {};
          return PROTECTED_USES.has(b.use) || t.historic !== undefined || t.heritage !== undefined || t.amenity === "place_of_worship";
        })
        .map((b) => ({ what: `${b.name ?? b.use} ${b.id}`, ring: ring(b.outline, b.x, b.z) })),
    ),
  ];
  const out: MetroLineFinding[] = [];
  for (const line of lines) {
    const seen = new Set<string>();
    for (const p of sample(line.points)) {
      for (const k of keep) {
        if (seen.has(k.what) || !pointInRing(p, k.ring)) continue;
        seen.add(k.what);
        out.push({ line: line.name, what: k.what, x: p.x, z: p.z });
      }
    }
  }
  return out;
};
