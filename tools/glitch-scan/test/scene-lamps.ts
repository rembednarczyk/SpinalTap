/**
 * Two checks from the curator's review of Plac Katedralny's lights (PR #1032, `docs/lokacje/plac-katedralny.md`):
 * `scene-lamp-in-solid`, a scene's lamp (`SCENE_LAMP_GROUPS`) inside a building's outline or under
 * the ground, which lights nothing it should (the motivated lighting of `docs/zasady-lokacji.md`
 * §13: a lamp by its fitting, in the frame); and `beacon-off-tip`, an obstruction light more than
 * `TIP_OFF` from the middle of the building it tops or out of [its tip, tip + `TIP_OVER`] (ICAO
 * Annex 14: the light marks the top). Both start at nought.
 */

type Finding = { readonly at: string; readonly what: string };

/** A scene's lamp where the scan reads it: its group, key and world point. */
export interface ScanLamp {
  readonly group: string;
  readonly key: string;
  readonly at: { readonly x: number; readonly y: number; readonly z: number };
}

/** How far under the ground a lamp may hang before it is in the ground (m): a fitting set in the paving. */
export const UNDER = 0.05;

/** The lamps in a building's outline or under the ground. */
export const sceneLampInSolid = (lamps: readonly ScanLamp[], inBuilding: (x: number, z: number) => boolean, ground: (x: number, z: number) => number): Finding[] =>
  lamps.flatMap((l) => {
    const { x, y, z } = l.at;
    const at = `${x.toFixed(0)},${z.toFixed(0)}`;
    if (inBuilding(x, z)) return [{ at, what: `${l.group} ${l.key} in a building` }];
    const under = ground(x, z) - y;
    return under > UNDER ? [{ at, what: `${l.group} ${l.key} ${under.toFixed(2)} m under the ground` }] : [];
  });

/** An obstruction light and the building it marks: its middle (x, z) and its tip's world y. */
export interface ScanBeacon {
  readonly id: string;
  readonly at: { readonly x: number; readonly y: number; readonly z: number };
  readonly top: { readonly x: number; readonly z: number; readonly y: number };
}

/** How far from the middle of its building a beacon may stand (m). */
export const TIP_OFF = 0.3;
/** How far over its building's tip a beacon may stand (m): on its mast's top. */
export const TIP_OVER = 0.5;

/** The beacons off their building's middle or out of the band over its tip. */
export const beaconOffTip = (beacons: readonly ScanBeacon[]): Finding[] =>
  beacons.flatMap((b) => {
    const at = `${b.at.x.toFixed(0)},${b.at.z.toFixed(0)}`;
    const off = Math.hypot(b.at.x - b.top.x, b.at.z - b.top.z);
    if (off > TIP_OFF) return [{ at, what: `${b.id} ${off.toFixed(2)} m off its building's middle` }];
    const over = b.at.y - b.top.y;
    return over < 0 || over > TIP_OVER ? [{ at, what: `${b.id} ${over.toFixed(2)} m over its tip at ${b.top.y.toFixed(1)}` }] : [];
  });
