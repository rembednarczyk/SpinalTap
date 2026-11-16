/**
 * Where a lamp of the `lit` rule (G-798, `props-lit.ts`) may stand (`PlanItem.keepOff`, `props-gen`):
 * the plan's lines were drawn and checked by hand, the rule's ways are every lit way of the map, so
 * its lamps keep off the traffic's lanes, stay by the paving and keep off the ground under a deck.
 */
import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import type { Pt } from "./geometry.ts";
import type { Site } from "./props-site.ts";

const segGap = (p: Pt, a: Pt, b: Pt): number => segmentDistance(p.x, p.z, a.x, a.z, b.x, b.z);

/** How far past the paving a lamp of the rule may stand (m): short of the scan's 1 m (`lamp-off-band`, G-477). */
const PAVING_SLACK = 0.9;
const AROUND = Array.from({ length: 8 }, (_, i) => ({ x: Math.sin((i * Math.PI) / 4), z: Math.cos((i * Math.PI) / 4) }));

/** Whether a point lies on the paving (a pavement, a square, the carriageway) or within `PAVING_SLACK` of it. */
export const byPaving = (site: Site, p: Pt): boolean => {
  const paved = (q: Pt) => {
    const s = site.surfaceAt(q);
    return s === "walk" || s === "road";
  };
  return paved(p) || AROUND.some((u) => paved({ x: p.x + u.x * PAVING_SLACK, z: p.z + u.z * PAVING_SLACK }));
};

/** How far round a lamp on the ground a bridge's deck may not rise over it by `DECK_DROP` (m): the scan's `lamp-beside-deck` (G-503). */
const DECK_NEAR = [0.5, 1, 1.5, 2];
const DECK_DROP = 1.4;

/** Whether a lamp on the ground stands under or beside a bridge's deck `DECK_DROP` or more over it: down on the valley by the bridge's edge. */
export const underDeck = (site: Site, p: Pt): boolean => {
  const y = site.heightAt(p);
  const over = (q: Pt) => {
    const d = site.deckHeightAt(q);
    return d !== null && d - y >= DECK_DROP;
  };
  return over(p) || DECK_NEAR.some((r) => AROUND.some((u) => over({ x: p.x + u.x * r, z: p.z + u.z * r })));
};

/** The streets cars drive, as the simulation's roads have them (sim `roads.ts`, ADR-0050): in the Old Town's district its residential streets carry deliveries only. */
const CAR_KINDS: ReadonlySet<string> = new Set(["primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "residential", "unclassified"]);
const DELIVERIES: ReadonlySet<string> = new Set(["residential", "unclassified"]);

/** Whether a car street's axis runs within `reach` of a point. */
export const nearCars = (site: Site, p: Pt, reach: number): boolean => {
  const oldTown = site.chunkAt(p)?.district === "kanal";
  return site.streets.some((st) => CAR_KINDS.has(st.kind) && !(oldTown && DELIVERIES.has(st.kind)) && st.line.some((a, i) => i > 0 && segGap(p, st.line[i - 1]!, a) < reach));
};

/**
 * Whether a spot suits a lamp of the rule (`PlanItem.keepOff`): `keepOff` from a car street's axis
 * (`nearCars`), by the paving unless beside a path (`byPaving`), on a deck or clear of one (`underDeck`),
 * and not in a bridge's carriageway: a deck's lamp keeps its place (`offRoad` leaves it), so one on
 * Mełgiewska's 13 m deck by Andersa's kerb 4.75 m off its axis stood in the walkers' and cars' way.
 * Nor in a kerb car park's bays, `PARK_GAP` clear of them: a lamp turned to the other kerb (G-804)
 * stood in Świętoduska's bays and left them without cars (`bay-strip-sparse`).
 */
export const litSpot = (site: Site, p: Pt, keepOff: number, path: boolean, onDeck: boolean): boolean =>
  !nearCars(site, p, keepOff) && (path || byPaving(site, p)) && (onDeck || !underDeck(site, p)) && site.deckAt(p) !== "road" && !site.inKerbPark(p, PARK_GAP);

/** How far a lamp of the rule keeps out of a kerb car park (m): its solid's 0.27 m to its corner and a little to spare. */
const PARK_GAP = 0.5;

