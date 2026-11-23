import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { groundY } from "./lublin/terrain";
import { WORLD_STREET_PROPS } from "./street-props";

/*
 * Plac Katedralny after its card (`docs/lokacje/plac-katedralny.md`, ADR-0102 point 5). Pattern: environmental
 * storytelling (Smith and Worch, GDC 2010). The second faction of the square is the parish (no Hebi here): the LED grave
 * candles, flowers and intention cards at the Wyszyński monument's foot, before it as it faces; the AR legend terminal
 * by the Executioner's Stone under the tower (Blender, `tools/blender/rooms/plac_katedralny.py`).
 * Drawn only.
 */

const pieces = Object.values(WORLD_STREET_PROPS).flat();
/** The Wyszyński monument on the square (the import's `monument`). */
export const KATEDRALNY_MONUMENT = pieces.find((i) => i.prop === "monument" && Math.abs(i.x - 656.5) < 1 && Math.abs(i.z + 227.2) < 1);
/** The Executioner's Stone under the Trinitarian Tower (OSM `Głaz Katowski-Kamień Nieszczęścia`, the import's `granite-block`). */
export const GLAZ_KATOWSKI = pieces.find((i) => i.prop === "granite-block" && Math.abs(i.x - 582.7) < 1 && Math.abs(i.z + 135) < 1);

const before = (p: StreetPropItem, d: number) => ({ x: p.x + Math.sin(p.yaw) * d, z: p.z + Math.cos(p.yaw) * d });
const beside = (p: StreetPropItem, d: number) => ({ x: p.x + Math.cos(p.yaw) * d, z: p.z - Math.sin(p.yaw) * d });
const model = (key: string, at: { x: number; z: number }, yaw: number): StreetPropItem => ({ prop: "room-detail", x: at.x, y: groundY(at.x, at.z), z: at.z, yaw, variant: roomDetailShape(key) });

/**
 * The candles 1 m before the monument, facing as it faces; the terminal 1.5 m beside the stone. Each only where
 * the import has its anchor (the props' generator rebuilds the table it reads under its own test, G-745).
 */
export const KATEDRALNY_DETAIL: readonly StreetPropItem[] = [
  ...(KATEDRALNY_MONUMENT ? [model("rd-kat-candles", before(KATEDRALNY_MONUMENT, 1.0), KATEDRALNY_MONUMENT.yaw)] : []),
  // Its screen to the square, away from the tower's wall the stone faces.
  ...(GLAZ_KATOWSKI ? [model("rd-kat-terminal", beside(GLAZ_KATOWSKI, 1.5), GLAZ_KATOWSKI.yaw + Math.PI)] : []),
];
