/**
 * The odds and ends of ADR-0096 (`clutter`): one model of `extra-props.glb` per shape, the shape in a
 * piece's `variant`. The generator (`tools/osm-import`, `props-clutter.ts`) picks the shape, the
 * simulation stands its solid (`content/lublin/furniture.ts`), the renderer bakes its model. A solid's
 * half sides and top are in metres over the foot, centred on it; none for what a walker steps over or
 * what hangs on a wall.
 */
export interface ClutterShape {
  /** The model's key in `extra-props.glb`. */
  readonly key: string;
  readonly solid: { readonly hx: number; readonly hz: number; readonly top: number } | null;
}

export const CLUTTER_SHAPES: readonly ClutterShape[] = [
  // At the back of a restaurant (ADR-0096 rule 1).
  { key: "ex-bag-a", solid: null },
  { key: "ex-bag-b", solid: null },
  { key: "ex-box-a", solid: null },
  { key: "ex-box-b", solid: null },
  { key: "ex-bin-boarded", solid: { hx: 0.31, hz: 0.29, top: 1.0 } },
  { key: "ex-bottle", solid: null },
  { key: "ex-cup", solid: null },
  { key: "ex-barrel", solid: { hx: 0.42, hz: 0.42, top: 1.05 } },
  // A cash machine set into a bank's wall (rule 3).
  { key: "ex-atm-wall", solid: null },
  // By a building site's fence on its street side (rule 2): the cone, the concrete (New Jersey) and the
  // red water-filled barrier, the steel crowd barriers by the gate, whole and bent. Their solids are
  // the body a walker meets, not the splayed feet.
  { key: "ex-cone", solid: { hx: 0.2, hz: 0.2, top: 0.75 } },
  { key: "ex-barrier-concrete", solid: { hx: 0.78, hz: 0.35, top: 0.81 } },
  { key: "ex-barrier-red", solid: { hx: 0.53, hz: 0.3, top: 0.8 } },
  { key: "ex-railing-a", solid: { hx: 1.0, hz: 0.25, top: 1.1 } },
  { key: "ex-railing-a-bent", solid: { hx: 1.0, hz: 0.25, top: 1.1 } },
  { key: "ex-railing-b", solid: { hx: 1.42, hz: 0.3, top: 1.1 } },
  { key: "ex-railing-b-bent", solid: { hx: 1.38, hz: 0.3, top: 1.1 } },
];

/** Shapes by role, as the generator picks them. */
export const CLUTTER = {
  bags: [0, 1],
  boxes: [2, 3],
  bin: 4,
  litter: [5, 6],
  barrel: 7,
  atmWall: 8,
  cone: 9,
  /** The concrete barrier, the red one. */
  barriers: [10, 11],
  /** The crowd barriers, each whole then bent: the short one (2 m), the long one (2.9 m). */
  railings: [
    [12, 13],
    [14, 15],
  ],
} as const;

/** The first shape of a building site's (rule 2): the phones draw these, they are solids on the pavement. */
export const SITE_CLUTTER_FROM = 9;
