/**
 * The game's own doors in Lublin (the clinic and Neon Koi on the deptak, ADR-0038) for the market's
 * furniture to keep clear of (`props-food.ts`). It reads the simulation's content modules: Node
 * loads it through Vite's module runner (`props.ts`), the tests directly.
 */
import { S7_DOORS } from "../../../packages/sim/src/content/interiors";
import { type DoorSpan, doorSpan } from "./props-roads.ts";

/** The jambs of every door of the game's interiors, in world metres. */
export const gameDoors = (): DoorSpan[] => S7_DOORS.map(doorSpan);
