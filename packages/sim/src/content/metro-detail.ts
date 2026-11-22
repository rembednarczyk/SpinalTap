import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { METRO_PLATFORMS } from "./metro";
import { inwardYaw, spotFrame } from "./metro-pavilion";
import { FLIGHT, PLATFORM, type PlatformDef } from "./metro-platform";
import { type DressTaken, type RoomLayout, dressRoom } from "./room-dressing";

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

/** The safety strip and the screen doors along the platform's edge: nothing stands this near it. */
const EDGE_CLEAR = 1.0;
/** Kept clear before the stairs' foot and at the platform's ends (the end walls' doorways). */
const STAIRS_CLEAR = 3.5;
const END_CLEAR = 1.5;

/**
 * A platform as a room for the dressing generator (ADR-0099): its back wall, its benches' tops, its stairs' foot,
 * ends, edge and ticket machine kept clear, the benches and the things placed by hand (`detail`) taken.
 */
export const platformLayout = (p: PlatformDef, id: string, hand: readonly StreetPropItem[]): RoomLayout => {
  const { point, rect } = spotFrame(p.spot);
  const o = point(0, 0);
  const i = point(1, 0);
  const inward = { x: i.x - o.x, z: i.z - o.z };
  const half = FLIGHT.width / 2;
  const yaw = inwardYaw(p.spot, 1);
  const m = p.machine;
  const ms = Math.max(p.machineSize.x, p.machineSize.z) / 2 + 1;
  // The things placed by hand on the floor (the validator, the bin) and on the first bench (the litter): taken, the
  // bin a hero the butts gather round.
  const handTaken = hand
    .filter((h) => h.y < p.floor + PLATFORM.ceiling - 1)
    .map((h): DressTaken => {
      const onTop = h.y > p.floor + 0.2;
      const r = onTop ? 0.45 : 0.35;
      return { minX: h.x - r, maxX: h.x + r, minZ: h.z - r, maxZ: h.z + r, key: h.prop === "waste-bin" ? "waste-bin" : undefined, onTop };
    });
  return {
    id,
    kind: "platform",
    floor: p.floor,
    bounds: rect(p.u.back, p.u.edge - EDGE_CLEAR, p.w0, p.w1),
    walls: [{ a: point(p.u.back, p.w0 + 0.3), b: point(p.u.back, p.w1 - 0.3), inward }],
    surfaces: p.benches.map((w) => ({ ...rect(p.u.back + 0.05, p.u.back + 0.45, w - 0.95, w + 0.95), top: p.floor + 0.45, yaw })),
    clear: [
      rect(p.u.back, p.u.back + STAIRS_CLEAR, -half - 1, half + 1),
      rect(p.u.back, p.u.edge, p.w0, p.w0 + END_CLEAR),
      rect(p.u.back, p.u.edge, p.w1 - END_CLEAR, p.w1),
      { minX: m.x - ms, maxX: m.x + ms, minZ: m.z - ms, maxZ: m.z + ms },
    ],
    taken: [...p.benches.map((w) => rect(p.u.back, p.u.back + 0.5, w - 1, w + 1)), ...handTaken],
  };
};

/** Each platform's detail, in the order of `METRO_PLATFORMS`: placed by hand, then dressed by its kit (ADR-0099). */
export const METRO_DETAIL: readonly (readonly StreetPropItem[])[] = METRO_PLATFORMS.map((e, i) => {
  const hand = detail(e.platform, i);
  return [...hand, ...dressRoom(platformLayout(e.platform, `metro-${e.station}`, hand))];
});
