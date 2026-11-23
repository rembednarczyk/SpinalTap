import type { Vec3 } from "@seki/core";
import { SCENE_LAMP_GROUPS, type SceneLampGroup } from "@seki/sim";
import type { ToonMaterials } from "../../npr/toon-material";

/** On past `near`, a group stays on this much farther before it goes off (m): no flicker at the edge. */
const HOLD = 5;

/**
 * The scenes' lights on the map (`SCENE_LAMP_GROUPS`, ADR-0102 point 5): each group's point lights on while the eye is
 * near its place and the city is out (not in a closed hall, ADR-0082 §3.8), off elsewhere, so the toon shader's few
 * light slots go to the street round the eye. The lights' fittings are the scenes' models; this part draws nothing.
 * A part of the map city, as Alchemia's pavilion lamps are of its view (`PavilionLamps`).
 */
export class SceneLamps {
  private readonly on = new Set<string>();

  constructor(
    private readonly materials: Pick<ToonMaterials, "addLight" | "removeLight">,
    private readonly groups: readonly SceneLampGroup[] = SCENE_LAMP_GROUPS,
  ) {}

  /** Each frame: each group on near its place (`allowed` false: all off). */
  update(eye: Vec3, allowed: boolean): void {
    for (const g of this.groups) {
      const lit = this.on.has(g.id);
      const d = Math.hypot(eye.x - g.centre.x, eye.z - g.centre.z);
      const want = allowed && d < g.near + (lit ? HOLD : 0);
      if (want === lit) continue;
      if (want) this.on.add(g.id);
      else this.on.delete(g.id);
      for (const l of g.lamps) {
        if (want) this.materials.addLight(l.key, { position: l.at, color: l.color, range: l.range, intensity: l.intensity });
        else this.materials.removeLight(l.key);
      }
    }
  }

  /** The groups lit now (tests, debug). */
  get lit(): readonly string[] {
    return [...this.on];
  }
}
