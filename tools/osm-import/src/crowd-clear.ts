/**
 * The simulation's moving crowd (ADR-0050) the still crowd of ADR-0058 stage 8 keeps clear of
 * (`props-figures.ts`): the residents' spots (at the walls, the benches, the kiosks and the shelters),
 * the passers-by's spots and the named characters' places, and the crowd's lanes as closed lines. It
 * reads the simulation's content modules: Node loads it through Vite's module runner (`props.ts`), the
 * tests directly. The figures have no solid and are no seat of the crowd, so the crowd read here does
 * not depend on them: the table is its own fixed point.
 */
import { ACTIVITY_SPOTS } from "../../../packages/sim/src/content/activity-spots";
import { CROWD_LANES, CROWD_SPOTS } from "../../../packages/sim/src/content/crowd";
import { GAME_ACTORS } from "../../../packages/sim/src/content/street-props";
import type { CrowdClear } from "./props-figures.ts";

export const crowdClear = (): CrowdClear => ({
  spots: [...CROWD_SPOTS.map((s) => s.at), ...ACTIVITY_SPOTS.map((s) => s.at), ...GAME_ACTORS.map((a) => a.spawn.position)].map((p) => ({ x: p.x, z: p.z })),
  lanes: CROWD_LANES.map((l) => [...l.points, l.points[0]!].map(([x, z]) => ({ x, z }))),
});
