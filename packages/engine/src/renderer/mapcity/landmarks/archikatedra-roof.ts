import type { ChurchRoof, SideWindows } from "./recipe-types";

/**
 * The Archikatedra's roofscape and side windows (T-349 stage K3), placed in the church's frame: u
 * metres along its axis (6.3° from world x towards +z, east) and v across it (north) from the
 * outline's middle (634.2, −183.8), as the import's parts (`corrections-katedra.ts`). The nave's
 * eaves at y 25 on v 10.0 and −6.7, its ridge at 31.5 on v 1.65 (the import's outline); NMPT has the
 * ridge turret to y 35 at u 3-5 and the chapels' domes to 22-23 at u ≈ 5, v ≈ 13.5 north and −7
 * south (in the game's −9.3, clear of the nave's south wall at −6.7).
 */

const TH = (6.3 * Math.PI) / 180;
const [COS, SIN] = [Math.cos(TH), Math.sin(TH)];
const at = (u: number, v: number) => ({ x: 634.2 + u * COS - v * SIN, z: -183.8 + u * SIN + v * COS });
/** The unit direction across the axis to the north (+v), world. */
const NORTH = { x: -SIN, z: COS };

/** A dormer 1.6 m in from the eaves on each slope, where the slope stands at y 26.2: from 26.1 to 27.6. */
const DORMER_U = [-15, -9, -3, 3, 9] as const;
const dormers = DORMER_U.flatMap((u) => [
  { ...at(u, 8.4), fx: NORTH.x, fz: NORTH.z, y0: 26.1, y1: 27.6 },
  { ...at(u, -5.1), fx: -NORTH.x, fz: -NORTH.z, y0: 26.1, y1: 27.6 },
]);

export const NAVE_ROOF: ChurchRoof = {
  dormers,
  turret: { ...at(4, 1.65), y: 31.1, top: 35 },
  domes: [
    { ...at(4.5, 13.7), y: 14, r: 2, drum: 2.6, top: 23 },
    { ...at(6, -9.3), y: 14, r: 2, drum: 2.6, top: 22.5 },
  ],
};

/** The side windows of each storey: the annexes to y 8.3, the presbytery's side rooms to 11.5, the chapels to 14, the nave's clerestory to 25. */
export const ANNEX_WINDOWS: SideWindows = { pitch: 4.5, width: 1.2, y0: 2.6, y1: 6.6 };
export const SIDE_ROOM_WINDOWS: SideWindows = { pitch: 4, width: 1, y0: 9, y1: 10.8 };
export const CHAPEL_WINDOWS: SideWindows = { pitch: 5, width: 1.4, y0: 9.4, y1: 12.8 };
export const CLERESTORY: SideWindows = { pitch: 5.5, width: 1.8, y0: 16.5, y1: 22.5 };
