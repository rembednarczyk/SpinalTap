import type { StreetPropKind } from "@seki/core";
import type { KitModel } from "../city-kit-data";
import { type CityProps, type PropXform, addPropToSink, facing, pointSeed, propHash } from "../city-props";
import type { MeshSink } from "../mesh-sink";
import { type WorldProp, bake, placePoint } from "./prop-batch";
import { RACK_SHAPES, RACK_SLOTS } from "./prop-e2";
import { PROP_SHAPES } from "./prop-shapes";
import { bikeRack } from "./prop-street";

/**
 * Street furniture drawn as CC-BY models of `street-props.glb` (ADR-0063, the second Sketchfab pack,
 * docs/plany/assety-paczka-2.md, tools/city_street.py): drinks machines, ticket machines and the
 * cameras on their masts take a model of their kind once the props files have loaded, and one
 * market stall in `LANTERN_SHARE` gets two paper lanterns under its canopy (Podzamcze alone has
 * some 400 stalls: on every one they would add a third to the triangles of its blocks). Each model was fitted into its kind's solid
 * (sim `content/lublin/furniture.ts`) when it was baked, and stands where the procedural piece stood,
 * so the simulation does not change. Baked into the street furniture's block mesh like the poles:
 * vertices, not draw calls. Pure functions of the pieces.
 *
 * ADR-0058 stage 2 adds cash machines, hydrants, planters, food carts and containers (CC0 and CC-BY) the same way,
 * and the bikes and scooters parked across a bike rack's hoops (`RACK_SHAPES`), the hoops staying
 * procedural; these kinds' solids came with them.
 */

/** Kinds with models of their own in the props files; the style of a model is its kind. */
const MODEL_KINDS: ReadonlySet<StreetPropKind> = new Set(["vending-machine", "ticket-machine", "cctv", "atm", "hydrant", "planter", "food-cart", "container"]);

/**
 * Where a stall's lanterns hang, in its frame (`marketStall`: canopy underside 2.32 m), behind the
 * string of lights along its front edge (z 0.92) and over the counter.
 */
const LANTERNS = [
  { x: -0.7, z: 0.68 },
  { x: 0.7, z: 0.68 },
] as const;
const CANOPY = 2.32;
/** One stall in this many has lanterns. */
const LANTERN_SHARE = 3;

/**
 * A piece's model of the props files, or null: no file, or a kind without one. A kind with shapes
 * (the drinks machines' liveries) takes the model by its shape, so the shapes side by side differ;
 * one without, by its position.
 */
export const streetModel = (props: CityProps | null, p: WorldProp): KitModel | null => {
  const pool = props && MODEL_KINDS.has(p.prop) ? (props.byStyle.get(p.prop) ?? []) : [];
  const pick = (PROP_SHAPES[p.prop] ?? 1) > 1 ? p.shape : propHash(pointSeed(p), 70);
  return pool.length > 0 ? (pool[pick % pool.length] ?? null) : null;
};

/** The lantern of the props files, or null. */
export const lanternModel = (props: CityProps | null): KitModel | null => props?.byStyle.get("lantern")?.[0] ?? null;

/** Where a model goes for a piece: its foot on the piece's, its front along the piece's front (+z of its frame). */
export const pieceXform = (p: WorldProp, at: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }): PropXform =>
  facing(placePoint(p, at), { x: Math.sin(p.yaw), y: 0, z: Math.cos(p.yaw) }, { x: p.scale, y: p.scale, z: p.scale });

/** Does this stall have lanterns (one in `LANTERN_SHARE`, chosen by its position)? */
export const hasLanterns = (stall: WorldProp): boolean => stall.prop === "market-stall" && propHash(pointSeed(stall), 71) % LANTERN_SHARE === 0;

/** The xforms of a stall's lanterns: hung from the canopy, their tops at its underside. */
export const lanternXforms = (stall: WorldProp, lantern: KitModel): PropXform[] =>
  LANTERNS.map((l) => pieceXform(stall, { x: l.x, y: CANOPY - lantern.size.y, z: l.z }));

let hoops: MeshSink | null = null;

/** The bike and the scooter parked at the racks, or null without them. */
const parked = (props: CityProps) => {
  const bike = props.byStyle.get("parked-bike")?.[0];
  const scooter = props.byStyle.get("parked-scooter")?.[0];
  return bike && scooter ? { bike, scooter } : null;
};

/** The xforms and models of what a rack's shape parks across its hoops (none without the models). */
export const rackXforms = (props: CityProps | null, rack: WorldProp): { model: KitModel; xf: PropXform }[] => {
  const models = props ? parked(props) : null;
  if (!models || rack.prop !== "bike-rack") return [];
  return (RACK_SHAPES[rack.shape] ?? RACK_SHAPES[0]!).flatMap((slot, i) => (slot ? [{ model: models[slot], xf: pieceXform(rack, { x: RACK_SLOTS[i]!, y: 0, z: 0 }) }] : []));
};

/**
 * Bakes a piece as its model (true: it stands in for the procedural one), a rack's hoops with its
 * parked bikes (true), or a stall's lanterns (false: the stall keeps its procedural model, like
 * every piece without a model).
 */
export const bakeStreetModel = (sink: MeshSink, props: CityProps, p: WorldProp): boolean => {
  const bikes = rackXforms(props, p);
  if (bikes.length > 0) {
    hoops ??= bikeRack();
    bake(sink, hoops, p);
    for (const b of bikes) addPropToSink(sink, props, b.model, b.xf);
    return true;
  }
  const m = streetModel(props, p);
  if (m) {
    addPropToSink(sink, props, m, pieceXform(p));
    return true;
  }
  const lantern = hasLanterns(p) ? lanternModel(props) : null;
  if (lantern) for (const xf of lanternXforms(p, lantern)) addPropToSink(sink, props, lantern, xf);
  return false;
};
