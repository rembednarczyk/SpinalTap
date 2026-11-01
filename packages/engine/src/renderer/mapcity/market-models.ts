import type { KitModel } from "../city-kit-data";
import { type CityProps, type PropXform, addPropToSink, facing, pointSeed, propHash } from "../city-props";
import { MeshSink } from "../mesh-sink";
import { type WorldProp, bake, placePoint } from "./prop-batch";
import { propModel } from "./prop-models";
import { marketStall } from "./prop-civic";
import { paint, v3 } from "./prop-kit";

/**
 * The market's dressing (ADR-0058 stage 3) from the props files: what hangs under a stall's canvas
 * and lies on its counter, and the lanterns of the food booths. Paper lanterns (`st-lantern` of
 * `street-props.glb`) under one stall in `LANTERN_SHARE` and on every booth; the goods of
 * `market-props.glb` (`counter-goods`) on one stall's counter in `GOODS_SHARE`, in place of the
 * procedural stall's boxes; a noren of cloth strips along the canvas's front edge of one stall in
 * `NOREN_SHARE` without lanterns. Small things: they go only into the near mesh of the furniture's
 * block, which phones (`low`) bake without the props files. Pure functions of the pieces: no
 * draw calls, no simulation.
 */

/**
 * Where a stall's lanterns hang, in its frame (`marketStall`: canopy underside 2.32 m), behind the
 * string of lights along its front edge (z 0.92) and over the counter.
 */
const LANTERNS = [
  { x: -0.7, z: 0.68 },
  { x: 0.7, z: 0.68 },
] as const;
const CANOPY = 2.32;
/** A booth's lanterns: under its roof's front edge (sim `FOOD_STALL`, roof 2.4 m), in front of the noren. */
const BOOTH_LANTERNS = [
  { x: -0.85, z: 0.56 },
  { x: 0.85, z: 0.56 },
] as const;
const BOOTH_ROOF = 2.36;
/** One stall in this many has lanterns, goods on its counter, a noren. */
const LANTERN_SHARE = 3;
const GOODS_SHARE = 2;
const NOREN_SHARE = 2;
/** The top of a stall's counter (`marketStall`) and the middle of its depth. */
const COUNTER = { y: 1.03, z: 0.55 } as const;

/** Where a model goes for a piece: its foot on the piece's, its front along the piece's front (+z of its frame). */
export const pieceXform = (p: WorldProp, at: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }): PropXform =>
  facing(placePoint(p, at), { x: Math.sin(p.yaw), y: 0, z: Math.cos(p.yaw) }, { x: p.scale, y: p.scale, z: p.scale });

/** The lantern of the props files, or null. */
export const lanternModel = (props: CityProps | null): KitModel | null => props?.byStyle.get("lantern")?.[0] ?? null;

/** Does this stall have lanterns (one in `LANTERN_SHARE`, chosen by its position)? */
export const hasLanterns = (stall: WorldProp): boolean => stall.prop === "market-stall" && propHash(pointSeed(stall), 71) % LANTERN_SHARE === 0;

/** Does this stall have goods of the props files on its counter (one in `GOODS_SHARE`)? */
export const hasCounterGoods = (stall: WorldProp): boolean => stall.prop === "market-stall" && propHash(pointSeed(stall), 72) % GOODS_SHARE === 0;

/** Does this stall have a noren (one in `NOREN_SHARE` of those without lanterns)? */
export const hasNoren = (stall: WorldProp): boolean => stall.prop === "market-stall" && !hasLanterns(stall) && propHash(pointSeed(stall), 74) % NOREN_SHARE === 0;

/** The xforms of a stall's lanterns, or a booth's: hung from the canopy or the roof, their tops at its underside. */
export const lanternXforms = (piece: WorldProp, lantern: KitModel): PropXform[] =>
  piece.prop === "food-stall"
    ? BOOTH_LANTERNS.map((l) => pieceXform(piece, { x: l.x, y: BOOTH_ROOF - lantern.size.y, z: l.z }))
    : LANTERNS.map((l) => pieceXform(piece, { x: l.x, y: CANOPY - lantern.size.y, z: l.z }));

/** The goods for a stall's counter, by its position, or null without the models. */
export const counterGoods = (props: CityProps | null, stall: WorldProp): KitModel | null => {
  const pool = props?.byStyle.get("counter-goods") ?? [];
  return pool.length > 0 ? (pool[propHash(pointSeed(stall), 73) % pool.length] ?? null) : null;
};

const NOREN_CLOTH = ["#8e2457", "#167a80", "#9c6a1c"];
let noren: MeshSink | null = null;
const bare = new Map<number, MeshSink>();

/** The noren along a stall's canvas's front edge: five strips 0.4 m deep under the canopy (`marketStall`: 2.4 m wide at z 0.9). */
export const stallNoren = (): MeshSink => {
  if (!noren) {
    noren = new MeshSink();
    for (let i = 0; i < 5; i++) noren.box(v3(-0.96 + i * 0.48, CANOPY - 0.2, 0.88), 0.44, 0.4, 0.02, paint(NOREN_CLOTH[i % NOREN_CLOTH.length]!));
  }
  return noren;
};

/** A stall's procedural model without the boxes on its counter, built once per shape. */
const bareStall = (shape: number): MeshSink => {
  let m = bare.get(shape);
  if (!m) {
    m = marketStall(shape, false);
    bare.set(shape, m);
  }
  return m;
};

/**
 * Bakes a stall with its dressing (true), or nothing for a stall with none and every other piece
 * (false: the caller bakes it); a booth's lanterns over its model (false too, the model is the caller's).
 */
export const bakeMarketDressing = (sink: MeshSink, props: CityProps, p: WorldProp): boolean => {
  const lantern = hasLanterns(p) || p.prop === "food-stall" ? lanternModel(props) : null;
  if (p.prop === "food-stall") {
    if (lantern) for (const xf of lanternXforms(p, lantern)) addPropToSink(sink, props, lantern, xf);
    return false;
  }
  if (p.prop !== "market-stall") return false;
  const goods = hasCounterGoods(p) ? counterGoods(props, p) : null;
  const cloth = hasNoren(p);
  if (!goods && !cloth && !lantern) return false;
  bake(sink, goods ? bareStall(p.shape) : propModel("market-stall", p.shape).sink, p);
  if (goods) addPropToSink(sink, props, goods, pieceXform(p, { x: 0, y: COUNTER.y, z: COUNTER.z }));
  if (cloth) bake(sink, stallNoren(), p);
  if (lantern) for (const xf of lanternXforms(p, lantern)) addPropToSink(sink, props, lantern, xf);
  return true;
};
