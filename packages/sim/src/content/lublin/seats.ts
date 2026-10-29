import type { ActivityId, StreetPropItem } from "@seki/core";
import { turnLocal } from "./furniture";

/**
 * Where people sit, queue and wait at the street furniture (ADR-0050), in the piece's own frame
 * turned by its yaw: the seats of a bench, the stools round a café garden's tables, the queue
 * at a kiosk's window, the bench and the dry corner of a bus shelter. A seated figure keeps its
 * feet where it stands and its hips about 0.45 m behind, so a seat's spot is in front of it,
 * clear of the piece's solid by a body's radius.
 */

export interface SeatSpot {
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly does: readonly [ActivityId, ...ActivityId[]];
  /** Under a roof (a shelter): no umbrella. */
  readonly indoor?: true;
}

/** One spot of a piece, in its frame: (x, z), facing turned by `turn` from the piece's front. */
interface Local {
  readonly x: number;
  readonly z: number;
  readonly turn: number;
  readonly does: readonly [ActivityId, ...ActivityId[]];
  readonly indoor?: true;
}

const at = (x: number, z: number, turn: number, does: readonly [ActivityId, ...ActivityId[]], indoor = false): Local => (indoor ? { x, z, turn, does, indoor: true } : { x, z, turn, does });

const SIT: readonly [ActivityId] = ["sit"];
const WAIT: readonly [ActivityId, ...ActivityId[]] = ["phone", "idle", "smoke"];
const BACK = Math.PI;
const LEFT = Math.PI / 2;
const RIGHT = -Math.PI / 2;

/** A spot this far in front of a bench's solid face (0.27 m) leaves a body's radius to it. */
const BENCH_FRONT = 0.67;

/** The groups of spots a kind of furniture offers, by shape; each group is taken together. */
const SPOTS: Partial<Record<StreetPropItem["prop"], (shape: number) => readonly (readonly Local[])[]>> = {
  // The long ława seats three, the bench with a back two.
  bench: (s) => [s === 0 ? [at(-0.75, BENCH_FRONT, 0, SIT), at(0, BENCH_FRONT, 0, SIT), at(0.75, BENCH_FRONT, 0, SIT)] : [at(-0.5, BENCH_FRONT, 0, SIT), at(0.5, BENCH_FRONT, 0, SIT)]],
  // Two tables at x = ±1, z = -0.2 with a stool either side; two talking by the fence outside.
  "cafe-garden": () => [
    [at(-1, -0.75, 0, SIT), at(-1, 0.35, BACK, SIT), at(1, -0.75, 0, SIT), at(1, 0.35, BACK, SIT)],
    [at(-0.45, 2.15, LEFT, ["talk"]), at(0.45, 2.15, RIGHT, ["talk"])],
  ],
  // The queue at the window, facing it: the first one buys.
  kiosk: () => [[at(0, 1.55, BACK, ["talk"]), at(0.15, 2.45, BACK, ["phone", "idle"]), at(-0.1, 3.35, BACK, ["idle", "phone"])]],
  // On the shelter's bench, and two standing under the roof watching the street.
  "bus-shelter": () => [[at(-0.6, 0.2, 0, SIT, true), at(0.55, 0.15, 0, WAIT, true), at(1.2, 0.45, -0.4, WAIT, true)]],
};

const SHAPES: Partial<Record<StreetPropItem["prop"], number>> = { bench: 2, "cafe-garden": 3 };

/** The groups of world spots a piece offers (none for most kinds). */
export const seatGroups = (item: StreetPropItem): SeatSpot[][] => {
  const groups = SPOTS[item.prop]?.(item.variant % (SHAPES[item.prop] ?? 1)) ?? [];
  return groups.map((g) =>
    g.map((l) => {
      const p = turnLocal(item.yaw, l.x, l.z);
      const spot = { x: Math.round((item.x + p.x) * 100) / 100, z: Math.round((item.z + p.z) * 100) / 100, yaw: item.yaw + l.turn, does: l.does };
      return l.indoor ? { ...spot, indoor: true as const } : spot;
    }),
  );
};

/** Kinds whose pieces offer spots. */
export const SEAT_KINDS: ReadonlySet<StreetPropItem["prop"]> = new Set(Object.keys(SPOTS) as StreetPropItem["prop"][]);
