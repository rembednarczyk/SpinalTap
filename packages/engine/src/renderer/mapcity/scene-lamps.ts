import type { Vec3 } from "@seki/core";
import { SCENE_LAMP_GROUPS, type SceneLamp, type SceneLampGroup } from "@seki/sim";
import type { ToonMaterials } from "../../npr/toon-material";

/** On past `near`, a group stays on this much farther before it goes off (m): no flicker at the edge. */
const HOLD = 5;
/**
 * How many of the scenes' lights are registered at once, the nearest to the eye: the toon shader has eight point
 * slots and gives them in registration order near the eye (`addLight`), so a market of 171 festoons registered whole
 * would light whichever stalls came first, not the ones round the player; the rest of the slots stay for the
 * street's other lights.
 */
export const SCENE_LAMP_SLOTS = 5;
/** The eye moves this far before the nearest lights are picked again (m). */
const REPICK = 1;

/**
 * The scenes' lights on the map (`SCENE_LAMP_GROUPS`, ADR-0102 point 5): of the groups whose place is near the eye
 * while the city is out (not in a closed hall, ADR-0082 §3.8), the `SCENE_LAMP_SLOTS` lights nearest the eye are
 * registered, the others not, so the toon shader's few light slots light the stalls round the player. The lights'
 * fittings are the scenes' models; this part draws nothing. A part of the map city, as Alchemia's pavilion lamps are
 * of its view (`PavilionLamps`).
 */
export class SceneLamps {
  private readonly on = new Set<string>();
  private readonly lit = new Map<string, SceneLamp>();
  private picked: Vec3 | null = null;

  constructor(
    private readonly materials: Pick<ToonMaterials, "addLight" | "removeLight">,
    private readonly groups: readonly SceneLampGroup[] = SCENE_LAMP_GROUPS,
  ) {}

  /** Each frame: the groups near their places on (`allowed` false: all off), their nearest lights registered. */
  update(eye: Vec3, allowed: boolean): void {
    let changed = false;
    for (const g of this.groups) {
      const was = this.on.has(g.id);
      const d = Math.hypot(eye.x - g.centre.x, eye.z - g.centre.z);
      const want = allowed && d < g.near + (was ? HOLD : 0);
      if (want === was) continue;
      if (want) this.on.add(g.id);
      else this.on.delete(g.id);
      changed = true;
    }
    if (!changed && this.picked && Math.hypot(eye.x - this.picked.x, eye.y - this.picked.y, eye.z - this.picked.z) < REPICK) return;
    this.picked = { ...eye };
    const near = (l: SceneLamp) => Math.hypot(eye.x - l.at.x, eye.y - l.at.y, eye.z - l.at.z);
    const nearest = this.groups
      .filter((g) => this.on.has(g.id))
      .flatMap((g) => g.lamps)
      .map((l) => ({ l, d: near(l) }))
      .sort((a, b) => a.d - b.d || (a.l.key < b.l.key ? -1 : 1))
      .slice(0, SCENE_LAMP_SLOTS)
      .map((x) => x.l);
    const keep = new Set(nearest.map((l) => l.key));
    for (const key of [...this.lit.keys()]) {
      if (keep.has(key)) continue;
      this.materials.removeLight(key);
      this.lit.delete(key);
    }
    for (const l of nearest) {
      if (this.lit.has(l.key)) continue;
      this.materials.addLight(l.key, { position: l.at, color: l.color, range: l.range, intensity: l.intensity });
      this.lit.set(l.key, l);
    }
  }

  /** The groups on now (tests, debug). */
  get groupsOn(): readonly string[] {
    return [...this.on];
  }

  /** The keys of the lights registered now (tests, debug). */
  get lightsOn(): readonly string[] {
    return [...this.lit.keys()];
  }
}
