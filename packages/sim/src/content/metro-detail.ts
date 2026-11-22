import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { METRO_PLATFORMS } from "./metro";
import { inwardYaw, spotFrame } from "./metro-pavilion";
import { FLIGHT, PLATFORM, type PlatformDef } from "./metro-platform";

/*
 * The metro's platforms' detail after their cards (`docs/pomieszczenia/metro-*.md`, ADR-0098): the models Blender builds
 * (`tools/blender/rooms/metro.py`) and the game's waste bin, placed on each platform from its own layout (its frame `u`
 * from the opening inwards, `w` across; the back wall at `u.back`, the benches along it): the grille between the first
 * two benches over the station's name plate, wall pieces 12 mm off the wall (over the engine's 10 mm band of tiles), the poster between the last two, the litter on the first bench, the timetable's screen hanging over the
 * platform's middle, the validator and the bin either side of the stairs' foot, the camera on the back wall over the
 * stairs. Drawn only, by the walls, on a bench and under the ceiling: the platform's solids stay. A model's front (+z)
 * faces the platform's track (+u) at `inwardYaw(spot, 1)`. Pure data.
 */

const detail = (p: PlatformDef, index: number): StreetPropItem[] => {
  const { point } = spotFrame(p.spot);
  const yaw = inwardYaw(p.spot, 1);
  const half = FLIGHT.width / 2;
  const roof = p.floor + PLATFORM.ceiling;
  const b = p.benches;
  const first = b[0] ?? p.w0 + 3;
  const second = b[1] ?? first + 4;
  const last = b[b.length - 1] ?? p.w1 - 3;
  const beforeLast = b[b.length - 2] ?? last - 4;
  const at = (key: string, u: number, w: number, y: number, prop: StreetPropItem["prop"] = "room-detail"): StreetPropItem => {
    const q = point(u, w);
    return { prop, x: q.x, y, z: q.z, yaw, variant: prop === "room-detail" ? roomDetailShape(key) : 0 };
  };
  return [
    at("rd-metro-vent", p.u.back + 0.012, (first + second) / 2, p.floor + 3.25),
    at(index % 2 === 0 ? "rd-metro-poster-a" : "rd-metro-poster-b", p.u.back + 0.012, (beforeLast + last) / 2, p.floor + 1.2),
    at("rd-metro-litter", p.u.back + 0.25, first + 0.3, p.floor + 0.45),
    at("rd-metro-timetable", (p.u.back + p.u.edge) / 2, last - 1.5, roof),
    at("rd-metro-validator", p.u.back + 0.9, -(half + 0.6), p.floor),
    at("waste-bin", p.u.back + 0.3, -(half + 1.8), p.floor, "waste-bin"),
    at("rd-metro-camera", p.u.back + 0.012, half + 0.7, roof - 0.35),
  ];
};

/** Each platform's detail, in the order of `METRO_PLATFORMS`. */
export const METRO_DETAIL: readonly (readonly StreetPropItem[])[] = METRO_PLATFORMS.map((e, i) => detail(e.platform, i));
