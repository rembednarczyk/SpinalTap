import { METRO_ENTRANCES } from "./metro";
import type { SceneLampGroup } from "./scene-lamp";

/*
 * The light inside each metro pavilion (ADR-0071: a low glass pavilion). Its glass is see-through
 * (`pavilion-signs.ts`), so the stairs and the hall show at night lit by the cool strips under the
 * roof (`pavilion-dress.ts`), and the light spills onto the pavement round it: a way down marked by
 * its own light (§13), no light from nowhere. One light a pavilion, under the strips over the
 * stairs, on while the eye is near (the renderer's nearest `SCENE_LAMP_SLOTS`).
 */

/** Under the roof strips (the roof's underside some 3.1 m over the street). */
const UNDER_ROOF = 2.7;
/** The strips' cool white. */
const HALL_LIGHT = { color: "#e8f4ff", range: 6, intensity: 0.85 } as const;

export const METRO_HALL_LAMPS: readonly SceneLampGroup[] = METRO_ENTRANCES.map((e) => {
  const x = (e.outline.minX + e.outline.maxX) / 2;
  const z = (e.outline.minZ + e.outline.maxZ) / 2;
  return { id: `metro-hall-${e.station}-${e.label}`, centre: { x, z }, near: 40, lamps: [{ key: `metro-hall-${e.station}-${e.label}`, at: { x, y: e.street + UNDER_ROOF, z }, ...HALL_LIGHT }] };
});
