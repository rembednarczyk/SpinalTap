import { type Contract, type DoorSnapshot, contractKind } from "@seki/core";
import { DOOR_CLOSE_DELAY, DOOR_MOVE_TIME, DOOR_SENSOR } from "../content/doors";
import type { DoorLeaf, DoorLock, Entity, Interactable } from "../world/components";
import type { SimContext, System } from "../world/context";
import { raiseFlag } from "../world/domain-ops";
import { codeKnown } from "../world/hook-tracker";
import { inCreationOrder } from "../world/ordering";
import { raiseAlarm } from "./contract-system";
import { staffPass } from "./crime-system";

type Leaf = Entity & { door: DoorLeaf; solid: NonNullable<Entity["solid"]> };

/** A body this far above or below the sensor does not count (a floor above, a cellar). */
const SENSOR_REACH_Y = 2;

/** The lock of `door` was broken open during `contract` (ADR-0038). Kept in the domain flags. */
export const doorForcedFlag = (door: string, contract: Contract): string => `door-forced:${door}:${contract.id}`;

const runningOfKind = (ctx: SimContext, lock: Extract<DoorLock, { kind: "code" }>): Contract | null => {
  const c = ctx.state.domain.contracts.active;
  return c?.status === "active" && contractKind(c) === lock.during ? c : null;
};

/** May the player through a coded door now: the code, the staff's overalls, or a broken lock. */
const playerPass = (ctx: SimContext, door: string, lock: Extract<DoorLock, { kind: "code" }>): boolean => {
  if (staffPass(ctx, lock.staff)) return true;
  const c = runningOfKind(ctx, lock);
  return !!c && (codeKnown(ctx) || ctx.state.domain.flags.includes(doorForcedFlag(door, c)));
};

const mayOpen = (ctx: SimContext, leaf: DoorLeaf, b: Entity): boolean => {
  const lock = leaf.lock;
  if (!lock) return true;
  if (lock.kind === "sealed") return false;
  if (b.faction === lock.staff) return true;
  return !!b.player && playerPass(ctx, leaf.door, lock);
};

const inSensor = (leaf: DoorLeaf, b: Entity): boolean =>
  Math.hypot(b.position.x - leaf.sensor.x, b.position.z - leaf.sensor.z) <= DOOR_SENSOR && Math.abs(b.position.y - leaf.sensor.y) <= SENSOR_REACH_Y;

/** Does a body stand where the closed leaf would be (it never closes on anyone)? */
const inDoorway = (leaf: DoorLeaf, b: Entity & { body: NonNullable<Entity["body"]> }): boolean => {
  const { min, max } = leaf.closed;
  const r = b.body.radius;
  return (
    b.position.x > min.x - r &&
    b.position.x < max.x + r &&
    b.position.z > min.z - r &&
    b.position.z < max.z + r &&
    b.position.y < max.y &&
    b.position.y + b.body.height > min.y
  );
};

/** Puts the leaf where `open` says. */
export const placeLeaf = (e: Leaf): void => {
  const { closed, slide, open } = e.door;
  const dx = slide.x * open;
  const dz = slide.z * open;
  e.solid = { min: { x: closed.min.x + dx, y: closed.min.y, z: closed.min.z + dz }, max: { x: closed.max.x + dx, y: closed.max.y, z: closed.max.z + dz } };
  e.position = { x: (closed.min.x + closed.max.x) / 2 + dx, y: (closed.min.y + closed.max.y) / 2, z: (closed.min.z + closed.max.z) / 2 + dz };
};

/** What the panel of a coded door offers now, or null (the door lets the player through). */
const panelOffer = (ctx: SimContext, panel: Entity & { doorPanel: string }, lock: DoorLock | undefined): Interactable | null => {
  if (lock?.kind !== "code" || playerPass(ctx, panel.doorPanel, lock)) return null;
  const forcing = runningOfKind(ctx, lock) !== null;
  return {
    kind: "door",
    dialogueId: panel.doorPanel,
    prompt: forcing ? "Wyłam zamek (podniesie alarm)" : "Drzwi na kod: zamknięte",
    radius: 1.4,
  };
};

const syncPanels = (ctx: SimContext, leaves: readonly Leaf[]): void => {
  for (const p of inCreationOrder(ctx.world.with("doorPanel"))) {
    const lock = leaves.find((l) => l.door.door === p.doorPanel)?.door.lock;
    const next = panelOffer(ctx, p, lock);
    const now = p.interactable ?? null;
    if (now?.prompt === next?.prompt) continue;
    if (next === null) ctx.world.removeComponent(p, "interactable");
    else if (now === null) ctx.world.addComponent(p, "interactable", next);
    else p.interactable = next;
  }
};

/**
 * The interact key on a coded door's panel during its job: the lock breaks, the door lets the
 * player through for the rest of the job, and the job's alarm goes off (ADR-0038). Without the
 * job the panel only says the door is locked.
 */
export const forceDoor = (ctx: SimContext, panel: Entity): void => {
  const door = panel.doorPanel;
  const lock = door ? ctx.world.with("door").entities.find((l) => l.door.door === door)?.door.lock : undefined;
  if (!door || lock?.kind !== "code") return;
  const c = runningOfKind(ctx, lock);
  if (!c || ctx.state.domain.flags.includes(doorForcedFlag(door, c))) return;
  raiseFlag(ctx, doorForcedFlag(door, c));
  raiseAlarm(ctx, c);
};

/**
 * Automatic doors (ADR-0038). A leaf opens while a character who may pass stands in the sensor,
 * and closes once the sensor has been empty for DOOR_CLOSE_DELAY, never onto someone in the
 * doorway. Runs before movement, like the lifts: the collision of this step sees the leaf
 * where it is now. Sealed doors never move.
 */
export const doorSystem: System = {
  name: "doors",
  run(ctx) {
    const leaves = inCreationOrder(ctx.world.with("door", "solid"));
    if (leaves.length === 0) return;
    const bodies = inCreationOrder(ctx.world.with("body"));
    const step = ctx.dt / DOOR_MOVE_TIME;
    for (const e of leaves) {
      const d = e.door;
      if (d.lock?.kind === "sealed") continue;
      const wanted = bodies.some((b) => inSensor(d, b) && mayOpen(ctx, d, b));
      d.idle = wanted ? 0 : Math.min(DOOR_CLOSE_DELAY, d.idle + ctx.dt);
      let target = wanted || d.idle < DOOR_CLOSE_DELAY ? 1 : 0;
      // Opened only to let someone through: an idle closed door stays shut.
      if (!wanted && d.open === 0) target = 0;
      if (target === 0 && d.open > 0 && bodies.some((b) => inDoorway(d, b))) target = d.open;
      if (target === d.open) continue;
      d.open = target > d.open ? Math.min(target, d.open + step) : Math.max(target, d.open - step);
      placeLeaf(e);
    }
    syncPanels(ctx, leaves);
  },
};

/** Doors that are not shut and at rest, for the save (ADR-0038). */
export const doorSnapshots = (ctx: Pick<SimContext, "world">): DoorSnapshot[] =>
  inCreationOrder(ctx.world.with("door"))
    .filter((e) => e.door.open > 0 || e.door.idle < DOOR_CLOSE_DELAY)
    .map((e) => ({ key: e.door.key, open: e.door.open, idle: e.door.idle }));

/** Puts saved door state back onto the resident leaves. */
export const restoreDoors = (ctx: Pick<SimContext, "world">, saved: readonly DoorSnapshot[]): void => {
  if (saved.length === 0) return;
  for (const e of ctx.world.with("door", "solid")) {
    const s = saved.find((x) => x.key === e.door.key);
    if (!s) continue;
    e.door.open = Math.max(0, Math.min(1, s.open));
    e.door.idle = Math.max(0, Math.min(DOOR_CLOSE_DELAY, s.idle));
    placeLeaf(e);
    e.prevPosition = e.position;
  }
};
