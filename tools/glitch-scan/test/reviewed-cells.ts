import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO } from "../../osm-import/src/paths.ts";

/**
 * The chunks of the cells the curator has reviewed (`docs/mapa-pokrycie.json`): a city sum whose
 * threshold was set before a new row of chunks came in counts only these. The new cells
 * (`nieprzejrzane`, the Podzamcze north row of 23.11.2026) join the sums with the whole-city fix of
 * the bare paving and lawn rules, which takes their samples down rather than the threshold up.
 */
const unreviewed = new Set(
  (JSON.parse(readFileSync(join(REPO, "docs/mapa-pokrycie.json"), "utf8")) as { komorki: { id: string; status: string }[] }).komorki
    .filter((c) => c.status === "nieprzejrzane")
    .map((c) => c.id),
);

export const reviewedOnly = <C extends { readonly id: string }>(chunks: readonly C[]): C[] => chunks.filter((c) => !unreviewed.has(c.id));
