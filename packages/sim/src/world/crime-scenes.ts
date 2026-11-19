import { CRIME_GETAWAY_SECONDS, type EntityId, type MicroEventKind, type Vec3, type ViewDescriptor } from "@seki/core";
import { inBuilding } from "../content/lublin/places";
import { SIM_HZ } from "../step-rate";
import type { Entity } from "./components";
import type { MicroEventRun, SimContext } from "./context";

/*
 * The crimes of ADR-0091 stage 5b around a thing of the street: a deal by a crate (three of the
 * gang), a delivery drone two thieves are breaking into (it flies off with them done after 60 s),
 * a van two kidnappers are loading their victim into (it drives off after 45 s). The thing is a
 * transient entity of the crime, keyed as its people are (never saved), and goes with it.
 */

/** Where the gang stands round the crime's thing, relative to the spot, and which way it faces. */
export interface Post {
  readonly dx: number;
  readonly dz: number;
  readonly yaw: number;
}

const ring = (n: number, r: number, from = 0): readonly Post[] =>
  Array.from({ length: n }, (_, i) => {
    const a = from + (i * 2 * Math.PI) / n;
    // Facing the middle.
    return { dx: Math.sin(a) * r, dz: Math.cos(a) * r, yaw: a + Math.PI };
  });

/** The posts of a crime's gang: in front of the victim, round the crate or the drone, by the van's side door. */
export const POSTS: Readonly<Record<MicroEventKind, readonly Post[]>> = {
  mugging: [
    { dx: 1.4, dz: 1.2, yaw: Math.PI },
    { dx: -1.4, dz: 1.2, yaw: Math.PI },
  ],
  extortion: [
    { dx: 1.4, dz: 1.2, yaw: Math.PI },
    { dx: -1.4, dz: 1.2, yaw: Math.PI },
    { dx: 0, dz: 1.2, yaw: Math.PI },
  ],
  aid: [],
  deal: ring(3, 1.3),
  droneTheft: ring(2, 1.1, Math.PI / 2),
  kidnap: [
    { dx: 0.9, dz: -1.3, yaw: 0 },
    { dx: -0.9, dz: -1.3, yaw: 0 },
  ],
};

/** Does the crime have a passer-by in it (robbed, squeezed, helped, kidnapped)? */
export const hasVictim = (kind: MicroEventKind): boolean => kind !== "deal" && kind !== "droneTheft";

const CRATE: ViewDescriptor = { kind: "block", size: { x: 0.9, y: 0.6, z: 0.6 }, material: "metal" };
const DRONE: ViewDescriptor = { kind: "block", size: { x: 1.1, y: 0.45, z: 1.1 }, material: "metal" };
const VAN: ViewDescriptor = { kind: "vehicle", model: "van", tint: 7 };

/** Half the van's length and width with a hand's room (ADR-0050 `VEHICLE_SIZE` "van", rounded up). */
const VAN_HALF = { l: 2.6, w: 1.05 };

/** The van's side, metres beyond the kidnappers, and its yaws to try: along either axis, then the diagonals. */
const VAN_OFF = 2.4;
const VAN_YAWS = [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4];

/** Is the van clear of the buildings at `c` with `yaw`: its corners, middle and ends? */
const vanFits = (c: Vec3, yaw: number): boolean => {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const pts: [number, number][] = [];
  for (const l of [-VAN_HALF.l, 0, VAN_HALF.l]) for (const w of [-VAN_HALF.w, VAN_HALF.w]) pts.push([c.x + fx * l + fz * w, c.z + fz * l - fx * w]);
  return pts.every(([x, z]) => !inBuilding(x, z));
};

/** Where the van stands by the spot: behind the victim, off the buildings; none where it does not fit. */
export const vanPlace = (at: Vec3): { readonly at: Vec3; readonly yaw: number } | null => {
  for (const yaw of VAN_YAWS) {
    for (const side of [1, -1]) {
      const c = { x: at.x, y: at.y, z: at.z + side * VAN_OFF };
      if (vanFits(c, yaw)) return { at: c, yaw };
    }
  }
  return null;
};

const thing = (ctx: SimContext, key: string, view: ViewDescriptor, at: Vec3, yaw: number): Entity => {
  // A block stands on its centre (`builders.ts`), a vehicle on its wheels.
  const lift = view.kind === "block" ? view.size.y / 2 : 0;
  const position = { x: at.x, y: ctx.streamer.ground.heightAt(at.x, at.z) + lift, z: at.z };
  const e: Entity = { id: ctx.streamer.takeId(), key, chunk: ctx.streamer.chunkIdAt(position), position, prevPosition: position, yaw, prevYaw: yaw, pitch: 0, view };
  ctx.world.add(e);
  return e;
};

/** The thing of a crime at its spot (none for a mugging, an extortion or an aid). */
export const crimeProps = (ctx: SimContext, id: string, kind: MicroEventKind, at: Vec3): readonly EntityId[] => {
  if (kind === "deal") return [thing(ctx, `${id}:crate`, CRATE, at, 0).id];
  if (kind === "droneTheft") return [thing(ctx, `${id}:drone`, DRONE, at, 0).id];
  if (kind !== "kidnap") return [];
  const van = vanPlace(at);
  return van ? [thing(ctx, `${id}:van`, VAN, van.at, van.yaw).id] : [];
};

/** Seconds the drone or the van takes to be gone once it leaves. */
export const GETAWAY_LEAVE_SECONDS = 3;
const RISE = 2.5;
const DRIVE = 9;

/** The step of the getaway the crime is at: before it, under way (the thing leaving), or over. */
export const getaway = (ctx: SimContext, run: MicroEventRun): "before" | "leaving" | "gone" => {
  if (run.kind !== "droneTheft" && run.kind !== "kidnap") return "before";
  const t = (ctx.tick - (run.since ?? ctx.tick)) / SIM_HZ;
  const at = CRIME_GETAWAY_SECONDS[run.kind];
  return t < at ? "before" : t < at + GETAWAY_LEAVE_SECONDS ? "leaving" : "gone";
};

const byId = (ctx: SimContext, id: EntityId): Entity | undefined => [...ctx.world].find((e) => e.id === id);

/** One step of the leaving drone (up) or van (off along its yaw): it moves, and takes the victim along. */
export const leave = (ctx: SimContext, run: MicroEventRun): void => {
  const dt = 1 / SIM_HZ;
  for (const id of run.props ?? []) {
    const e = byId(ctx, id);
    if (!e) continue;
    const v = run.kind === "droneTheft" ? { x: 0, y: RISE, z: 0 } : { x: Math.sin(e.yaw ?? 0) * DRIVE, y: 0, z: Math.cos(e.yaw ?? 0) * DRIVE };
    e.velocity = v;
    e.position = { x: e.position.x + v.x * dt, y: e.position.y + v.y * dt, z: e.position.z + v.z * dt };
  }
  // In the van with them.
  const victim = run.victim === null ? undefined : byId(ctx, run.victim);
  if (run.kind === "kidnap" && victim) ctx.world.remove(victim);
};

/** Was one of the gang alerted this step (a deal taken down quietly pays more)? */
export const alarmed = (ctx: SimContext, run: MicroEventRun): boolean => run.attackers.some((id) => byId(ctx, id)?.ai?.alerted === true);
