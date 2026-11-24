import { groundY } from "./lublin/terrain";
import type { SceneLamp, SceneLampGroup } from "./scene-lamp";

/*
 * Plac Katedralny by night (the 60-30-10 measure of 24.11: base 83%, light 15%, accents 1.3%, the square too dark; the
 * backlog's „reflektory fasady przepisu”). The four floodlights of the map stand on the square (585; −140), (597.8;
 * −153.8), (602.1; −176.9) and (620; −198.5) (since K4 (581.5; −139.8) and (591; −154.5) by the tower's faces), but drew only
 * their own glow: their washes are lights of the scene now,
 * each a few metres off the face it lights, on the side of its floodlight (motivated lighting: the source in the frame).
 * Two wash the Trinitarian Tower (w66286371, its body to y 25.5 and spire to 58.6 since K4), one the cathedral's west front
 * from under the portico, behind its columns (w66286341, K1: the floodlight stands there) and one its south wall. The tower is a broadcast mast in 2077 (the card): a red obstruction light blinks on its helm, the
 * square's accent seen across the Old Town (ICAO Annex 14's red obstruction light, as on the building sites' cranes).
 */

/** The floodlights' warm white over stone, as the city's illuminations of monuments. */
const WASH = { color: "#ffe3b8", range: 14, intensity: 1.15 } as const;

const lamp = (key: string, x: number, z: number, over: number): SceneLamp => ({ key, at: { x, y: groundY(x, z) + over, z }, ...WASH });

/** The washes: off the tower's north-west corner and its south face, off the cathedral's west front and its south wall. */
export const KATEDRALNY_LAMPS: SceneLampGroup = {
  id: "kanal-plac-katedralny",
  centre: { x: 600, z: -175 },
  near: 80,
  lamps: [
    lamp("kat-wash-tower-north", 581.5, -138.6, 9),
    lamp("kat-wash-tower-south", 591.0, -156.5, 12),
    lamp("kat-wash-front", 599.5, -179.5, 8),
    lamp("kat-wash-south-wall", 620.0, -201.0, 10),
  ],
};

/** The obstruction light at the tip of the tower's spire (its mast over y 58.6, T-353): its middle, world. */
export const KATEDRALNY_BEACON = { x: 586.4, y: 58.9, z: -147.3, color: "#ff2238" } as const;
