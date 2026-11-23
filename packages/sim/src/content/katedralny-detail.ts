import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { groundY } from "./lublin/terrain";
import { WORLD_STREET_PROPS } from "./street-props";

/*
 * Plac Katedralny after its card (`docs/lokacje/plac-katedralny.md`, ADR-0102 point 5). Pattern: environmental
 * storytelling (Smith and Worch, GDC 2010). The second faction of the square is the parish (no Hebi here): the LED grave
 * candles, flowers and intention cards at the Wyszyński monument's foot, before it as it faces; the AR legend terminal
 * by the Executioner's Stone, the artwork beside the figure of the Virgin (Blender, `tools/blender/rooms/plac_katedralny.py`).
 * Drawn only.
 */

const pieces = Object.values(WORLD_STREET_PROPS).flat();
/** The Wyszyński monument on the square (the import's `monument`). */
export const KATEDRALNY_MONUMENT = pieces.find((i) => i.prop === "monument" && Math.abs(i.x - 656.5) < 1 && Math.abs(i.z + 227.2) < 1)!;
/** The Executioner's Stone: the artwork 3.5 m from the figure of the Virgin (599.5, -197.9). */
export const GLAZ_KATOWSKI = pieces.find((i) => i.prop === "artwork" && Math.abs(i.x - 601.4) < 1 && Math.abs(i.z + 200.9) < 1)!;

const before = (p: StreetPropItem, d: number) => ({ x: p.x + Math.sin(p.yaw) * d, z: p.z + Math.cos(p.yaw) * d });
const beside = (p: StreetPropItem, d: number) => ({ x: p.x + Math.cos(p.yaw) * d, z: p.z - Math.sin(p.yaw) * d });
const model = (key: string, at: { x: number; z: number }, yaw: number): StreetPropItem => ({ prop: "room-detail", x: at.x, y: groundY(at.x, at.z), z: at.z, yaw, variant: roomDetailShape(key) });

/** The candles 1 m before the monument, the terminal 1.5 m beside the stone, both facing as they face. */
export const KATEDRALNY_DETAIL: readonly StreetPropItem[] = [
  model("rd-kat-candles", before(KATEDRALNY_MONUMENT, 1.0), KATEDRALNY_MONUMENT.yaw),
  model("rd-kat-terminal", beside(GLAZ_KATOWSKI, 1.5), GLAZ_KATOWSKI.yaw),
];
