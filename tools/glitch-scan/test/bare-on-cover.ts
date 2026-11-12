import { COVER } from "../../orto/src/classify.ts";
import { type Cover, coverAt, coverFor } from "../../orto/src/cover.ts";

/**
 * `bare-on-cover` (ADR-0077 step 1.1): a sample `landuse-bare` counts (bare ground in a town's
 * paved place) where the orthophoto's cover shows green or light paving, so what the import's rule
 * (`tools/osm-import/src/bare-cover.ts`) lays a lawn or paving on. What it leaves is the rule's own:
 * within 5 m of a carriageway behind bare ground (the kerbs' strips, step 1.2), by a bridge's deck,
 * the docks' cleared ground, a piece under its least area, a sample the outline's simplification
 * cuts off. Shade and crowns are not counted (they take the class round them, or stay), nor asphalt
 * (a stage of its own).
 */

type Finding = { readonly at: string; readonly what: string };

const CLASSES: ReadonlySet<number> = new Set([COVER.green, COVER.paving]);

/** The `landuse-bare` findings (`bare x,z`) on green or paving of `covers`, each named by its class. */
export const bareOnCover = (landuseBare: readonly Finding[], covers: readonly Cover[]): Finding[] =>
  landuseBare.flatMap((f) => {
    const m = /bare (-?[\d.]+),(-?[\d.]+)/.exec(f.what);
    if (!m) return [];
    const p = { x: Number(m[1]), z: Number(m[2]) };
    const c = coverFor(covers, p);
    const cls = c ? coverAt(c, p.x, p.z) : COVER.none;
    return CLASSES.has(cls) ? [{ at: f.at, what: `${f.what} ${cls === COVER.green ? "green" : "paving"}` }] : [];
  });
