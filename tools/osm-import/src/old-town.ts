/**
 * The walled Old Town of Lublin (G-264), in world metres: the ring through the gates and the
 * remnants of the town walls OSM maps, clockwise from Brama Krakowska. The district `kanal`
 * (`config.ts`) is wider than the walls: its rectangle takes in Królewska, Podwale and Kowalska
 * outside them, where the plan sets ordinary road lamps (`lamps.stare-miasto-edges`), and the
 * Rynek's circle of the skyline (`vertical.ts`, 80 m) does not reach Plac po Farze. Inside the
 * walls the city's lamps are styled (the user's decision of 2.11).
 */
import type { Pt } from "./geometry.ts";

export const OLD_TOWN_RING: readonly Pt[] = [
  // Brama Krakowska (w609951474 the wall north of it, Bramowa through the gate).
  { x: 463, z: -95 },
  { x: 472, z: -73 },
  // Brama Rybna w66293430, the gate of Ku Farze (w383282017).
  { x: 569, z: -17 },
  { x: 605, z: 52 },
  // Brama Grodzka w232362876 and the wall south of it, w232362994.
  { x: 705, z: 138 },
  { x: 721, z: 147 },
  { x: 716, z: 108 },
  { x: 701, z: 61 },
  // The eastern scarp past the ends of Złota and Jezuicka.
  { x: 700, z: -57 },
  { x: 690, z: -130 },
  // Wieża Trynitarska w66286371, Baszta Gotycka n4744982537.
  { x: 599, z: -145 },
  { x: 513, z: -146 },
];
