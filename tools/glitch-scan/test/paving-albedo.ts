import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GroundSurface } from "../../../packages/core/src";
import { planSurface } from "../../../packages/engine/src/renderer/mapcity/ground-plan";
import { MeshSink } from "../../../packages/engine/src/renderer/mesh-sink";
import { type AlbedoMedians } from "../../orto/src/albedo-medians.ts";

/**
 * `paving-albedo-drift` (G-721, G-734): a paving of the renderer's palette (`ORTHO_PAVING` in
 * `ground-plan.ts`) or another surface it lays whose brightness against the lawns, as the renderer lays both, differs by more
 * than `ALBEDO_DRIFT` from the same surface's on the orthophoto, in the committed medians of the
 * flight the palette is calibrated on (`data/orto/albedo-medians.json`, `reference`; written by
 * `tools/orto/src/albedo-report.ts --write-medians`). A palette or a map that moved off the
 * photograph shows here, not in a shot.
 */

type Finding = { readonly at: string; readonly what: string };

/** How far the ratio to the lawns may differ (Rec. 709 luma): the curator's threshold of G-734. */
export const ALBEDO_DRIFT = 0.25;

/**
 * Surfaces left out on purpose: the fountains' floor stays dark under its water, the player's
 * decision of 13.11, though the orthophoto shows the shallow pools' light floor (G-129).
 */
export const ALBEDO_EXCLUDED: ReadonlySet<string> = new Set(["basin"]);

const GROUND_PLAN = join(__dirname, "../../../packages/engine/src/renderer/mapcity/ground-plan.ts");

/** The surfaces of `ORTHO_PAVING` in the renderer's source (its keys), so the check follows the palette. */
export const orthoPavingKeys = (source = readFileSync(GROUND_PLAN, "utf8")): string[] => {
  const block = /const ORTHO_PAVING = \{([\s\S]*?)\} as const;/.exec(source)?.[1];
  return block ? [...block.matchAll(/^\s*(\w+): \{/gm)].map((m) => m[1]!) : [];
};

export const luma = (c: readonly number[]): number => 0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0);

type Laid = Exclude<GroundSurface, "water" | "basin" | "steps" | "crossing">;

/** The colour the renderer lays a surface in: a 4 m square of it on flat ground, its first vertex. */
export const laidColour = (surface: Laid): number[] => {
  const sink = new MeshSink();
  planSurface(sink, surface, [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 0, z: 4 }], () => 0, null);
  return sink.colors.slice(0, 3);
};

/** Each surface's luma against the lawns' as the renderer lays them. */
export const planToGrass = (surfaces: readonly string[], colour: (s: Laid) => readonly number[] = laidColour): Record<string, number> => {
  const grass = luma(colour("grass"));
  return Object.fromEntries(surfaces.map((s) => [s, luma(colour(s as Laid)) / grass]));
};

/** The surfaces the renderer lays in a colour of its own (`SURFACE_COLOR`), the lawns aside: the ratio's denominator. */
const LAID: ReadonlySet<string> = new Set(["road", "rail", "square", "cobble", "footway", "sidewalk"]);

/**
 * What the check compares: the palette's surfaces (`ORTHO_PAVING`) and every other surface the
 * renderer lays with a median in the reference flight (the sidewalks of G-734 before they joined
 * the palette, the roads), the excluded ones aside.
 */
export const albedoSurfaces = (palette: readonly string[], medians: AlbedoMedians | undefined): string[] => {
  const measured = Object.keys(medians?.flights[medians.reference]?.surfaces ?? {}).filter((s) => LAID.has(s));
  return [...new Set([...palette, ...measured])].filter((s) => !ALBEDO_EXCLUDED.has(s));
};

/** The surfaces whose ratio to the lawns is off the medians' by more than `ALBEDO_DRIFT`, or the medians missing. */
export const pavingAlbedoDrift = (plan: Readonly<Record<string, number>>, medians: AlbedoMedians | undefined): Finding[] => {
  if (!medians) return [{ at: "data/orto/albedo-medians.json", what: "no medians: node tools/orto/src/albedo-report.ts --write-medians" }];
  const ref = medians.flights[medians.reference];
  if (!ref) return [{ at: "data/orto/albedo-medians.json", what: `no reference flight ${medians.reference}` }];
  if (!Object.keys(plan).length) return [{ at: "ground-plan.ts", what: "no ORTHO_PAVING found in the renderer's source" }];
  const out: Finding[] = [];
  for (const [surface, ratio] of Object.entries(plan)) {
    if (ALBEDO_EXCLUDED.has(surface)) continue;
    const m = ref.surfaces[surface];
    const others = Object.entries(medians.flights).filter(([id]) => id !== medians.reference).map(([id, f]) => `${id} ${f.surfaces[surface]?.toGrass ?? "-"}`);
    if (!m) out.push({ at: `ground-plan:${surface}`, what: `${surface}: no median in ${medians.reference}` });
    else if (Math.abs(ratio - m.toGrass) > ALBEDO_DRIFT)
      out.push({ at: `ground-plan:${surface}`, what: `${surface}: ${ratio.toFixed(2)} of the lawns laid, ${m.toGrass} on the orthophoto ${medians.reference} (${m.samples} samples; ${others.join(", ")})` });
  }
  return out;
};
