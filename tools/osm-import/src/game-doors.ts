/**
 * The game's own doors in Lublin (the clinic and Neon Koi on the deptak, ADR-0038) for the market's
 * furniture to keep clear of (`props-food.ts`). It reads the simulation's content modules: Node
 * loads it through Vite's module runner (`props-build.ts`), the tests directly.
 */
import { S7_DOORS } from "../../../packages/sim/src/content/interiors";
import { PASSAGES } from "../../../packages/sim/src/content/lublin/sites";
import type { Pt } from "./geometry.ts";
import { type DoorSpan, doorSpan } from "./props-roads.ts";

/** The jambs of every door of the game's interiors, in world metres. */
export const gameDoors = (): DoorSpan[] => S7_DOORS.map(doorSpan);

/**
 * The mouths of every passage through the buildings (the gates, Trasa Podziemna's vestibule in the
 * Trybunał, the tenements' gateways, the covered lanes): the furniture keeps them clear (ADR-0094 stage 1).
 */
export const passageMouths = (): Pt[] => PASSAGES.flatMap((p) => [p.from, p.to]);
