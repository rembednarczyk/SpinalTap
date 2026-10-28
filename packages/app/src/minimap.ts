import { type ContractLog, type EntityId, M0_TARGET_TAG, contractTag } from "@seki/core";
import type { Entity, StaticProp } from "@seki/sim";
import type { MapLinkVm, MapMarkerVm, MapPlayerVm, MapRectVm, MapVm } from "@seki/ui";

/** Flat walkable strips (sidewalks) are thinner than this; anything solid is a building or cover. */
const FLAT = 0.3;
/** A solid whose underside is this high is a floor above the street (a deck, a balcony), not a building. */
const RAISED = 2;
/** The player counts as up on a level above this height (ADR-0021). */
const UPPER = 1.5;

const footprint = (p: StaticProp): MapRectVm | null =>
  p.view.kind === "block" ? { x: p.center.x, z: p.center.z, w: p.view.size.x, d: p.view.size.z } : null;

/** Stairs, the lift platform and ladders become icons (ADR-0021). */
const linkOf = (p: StaticProp): MapLinkVm | null => {
  if (p.view.kind !== "block") return null;
  if (p.view.slope?.steps) return { kind: "stairs", x: p.center.x, z: p.center.z };
  if (p.mechanism?.kind === "platform") return { kind: "lift", x: p.center.x, z: p.center.z };
  if (p.view.rungs) return { kind: "ladder", x: p.center.x, z: p.center.z };
  return null;
};

/**
 * Minimap geometry from district content: the ground plate is the outline, solid blocks are
 * buildings and cover, other flat blocks are sidewalks along the streets. Floors up in the air
 * (the overpass deck, the footbridge, a balcony) are a layer of their own, and stairs, lifts
 * and ladders are marked (ADR-0021).
 */
export const buildDistrictMap = (props: readonly StaticProp[]): MapVm => {
  const blocks: MapRectVm[] = [];
  const flats: MapRectVm[] = [];
  const decks: MapRectVm[] = [];
  const links: MapLinkVm[] = [];
  const water: MapRectVm[] = [];
  for (const p of props) {
    if (p.view.kind === "water") {
      water.push({ x: p.center.x, z: p.center.z, w: p.view.size.x, d: p.view.size.z });
      continue;
    }
    const r = footprint(p);
    if (!r || p.view.kind !== "block") continue;
    const link = linkOf(p);
    if (link) links.push(link);
    // Lift gates and buttons, ladder grab points: nothing to draw.
    if (p.mechanism && p.mechanism.kind !== "platform") continue;
    const bottom = p.center.y - p.view.size.y / 2;
    if (p.solid && bottom >= RAISED) decks.push(r);
    else if (p.solid && !link) blocks.push(r);
    else if (!p.solid && p.view.size.y <= FLAT) flats.push(r);
  }
  const area = (r: MapRectVm) => r.w * r.d;
  const ground = flats.reduce<MapRectVm | null>((best, r) => (!best || area(r) > area(best) ? r : best), null);
  const bounds = ground ?? { x: 0, z: 0, w: 0, d: 0 };
  return {
    bounds,
    blocks,
    streets: flats.filter((r) => r !== ground),
    ...(decks.length > 0 ? { decks } : {}),
    ...(links.length > 0 ? { links } : {}),
    ...(water.length > 0 ? { water } : {}),
  };
};

/** Metres; positions are snapped to this so the store only changes when the map would. */
const SNAP = 0.25;
const ANGLE_SNAP = Math.PI / 90;
const snap = (v: number, step: number) => Math.round(v / step) * step;

/**
 * A target is an area, not its door (ADR-0035): a circle of this radius around a point snapped
 * to the grid below, so it says where to look without giving the spot away, and stays put while
 * the target walks inside its cell.
 */
export const TARGET_AREA_RADIUS = 10;
const TARGET_AREA_GRID = 8;

/** Ground speed above which the player counts as moving (the map looks ahead), m/s. */
const MOVING_SPEED = 0.5;
/** Ground speed of a run: the map zooms out (ADR-0035), m/s. */
const RUN_SPEED = 5;
export const MAP_ZOOM_RUN = 1.35;
export const MAP_ZOOM_DASH = 1.6;
const ZOOM_EASE = 0.2;
const ZOOM_STEP = 0.05;

/** What decides the zoom and the extra markers of a frame. */
export interface MinimapContext {
  /** Simulation steps per second, to turn a step's movement into a speed. */
  readonly ticksPerSecond: number;
  /** A dash a moment ago. */
  readonly dashing?: boolean;
  /** On the metro: no dynamic zoom. */
  readonly riding?: boolean;
  /** The player wears a disguise: enforcers show. */
  readonly disguised?: boolean;
  /** Observers known to see through the disguise. */
  readonly enforcers?: ReadonlySet<EntityId>;
}

/** An enforcer (ADR-0033): its look says so (`view.enforcer`), or it has already seen through the disguise. */
const isEnforcer = (e: Entity, known: ReadonlySet<EntityId> | undefined): boolean => (known?.has(e.id) ?? false) || (e.view?.kind === "enemy" && e.view.enforcer === true);

const markerKind = (e: Entity, targetTags: ReadonlySet<string>, contract: boolean, ctx: MinimapContext): MapMarkerVm["kind"] | null => {
  // The contract givers: Kaito, Hana on the market, Genzō in the docks.
  if (e.interactable?.dialogueId === "fixer" || e.interactable?.dialogueId === "hana" || e.interactable?.dialogueId === "genzo") return "fixer";
  // Only accepted contracts (ADR-0035): the defector of an escort, a hack job's terminal, a retrieval crate.
  if (contract && (e.escort || e.interactable?.kind === "terminal" || e.interactable?.kind === "pickup")) return "target";
  if (e.tag && targetTags.has(e.tag) && (e.health?.current ?? 0) > 0) return "target";
  if (ctx.disguised && (e.health?.current ?? 1) > 0 && isEnforcer(e, ctx.enforcers)) return "enforcer";
  return null;
};

const markerOf = (e: Entity, kind: MapMarkerVm["kind"]): MapMarkerVm => {
  const id = e.key ?? `e${e.id}`;
  if (kind !== "target") return { id, kind, x: snap(e.position.x, SNAP), z: snap(e.position.z, SNAP) };
  return { id, kind, x: snap(e.position.x, TARGET_AREA_GRID), z: snap(e.position.z, TARGET_AREA_GRID), radius: TARGET_AREA_RADIUS };
};

const sameMarkers = (a: readonly MapMarkerVm[], b: readonly MapMarkerVm[]) =>
  a.length === b.length && a.every((m, i) => m.id === b[i]?.id && m.x === b[i].x && m.z === b[i].z && m.kind === b[i].kind && m.radius === b[i].radius);

export interface MinimapFrame {
  readonly mapPlayer: MapPlayerVm | null;
  readonly mapMarkers: readonly MapMarkerVm[];
  readonly mapZoom: number;
}

/** The zoom the map heads for: out while running or after a dash, never on the metro. */
export const targetZoom = (speed: number, sprinting: boolean, ctx: MinimapContext): number => {
  if (ctx.riding) return 1;
  if (ctx.dashing) return MAP_ZOOM_DASH;
  return sprinting || speed > RUN_SPEED ? MAP_ZOOM_RUN : 1;
};

const playerVm = (e: Entity, moving: boolean): MapPlayerVm => {
  const at = { x: snap(e.position.x, SNAP), z: snap(e.position.z, SNAP), yaw: snap(e.yaw, ANGLE_SNAP) };
  const up = e.position.y > UPPER ? { ...at, level: Math.round(e.position.y) } : at;
  return moving ? { ...up, moving: true } : up;
};

/**
 * Tracks the player and what is worth finding: fixers and the targets of accepted contracts
 * (ADR-0035), and enforcers while the player is disguised. Eases the zoom towards the speed's.
 * Returns the previous objects when nothing moved past the snap, so per-frame syncs do not
 * re-render.
 */
export const createMinimapTracker = () => {
  let player: MapPlayerVm | null = null;
  let markers: readonly MapMarkerVm[] = [];
  let zoom = 1;
  return (entities: Iterable<Entity>, flags: readonly string[], contracts: ContractLog, ctx: MinimapContext = { ticksPerSecond: 60 }): MinimapFrame => {
    const targetTags = new Set<string>();
    if (!flags.includes(`killed:${M0_TARGET_TAG}`)) targetTags.add(M0_TARGET_TAG);
    const contract = contracts.active?.status === "active";
    if (contracts.active && contract) targetTags.add(contractTag(contracts.active.id));
    let nextPlayer: MapPlayerVm | null = null;
    let goal = 1;
    const nextMarkers: MapMarkerVm[] = [];
    for (const e of entities) {
      if (e.player) {
        // Movement over the last step (an entity built by hand in a test may have no previous position).
        const prev = (e.prevPosition as Entity["prevPosition"] | undefined) ?? e.position;
        const speed = Math.hypot(e.position.x - prev.x, e.position.z - prev.z) * ctx.ticksPerSecond;
        nextPlayer = playerVm(e, !ctx.riding && speed > MOVING_SPEED);
        goal = targetZoom(speed, e.posture?.sprinting ?? false, ctx);
        continue;
      }
      const kind = markerKind(e, targetTags, contract, ctx);
      if (kind) nextMarkers.push(markerOf(e, kind));
    }
    // Eases towards the goal, at least one step a frame, so it always gets there.
    const delta = goal - zoom;
    const move = Math.min(Math.abs(delta), Math.max(ZOOM_STEP, Math.abs(delta) * ZOOM_EASE));
    zoom = Math.round((zoom + Math.sign(delta) * move) / ZOOM_STEP) * ZOOM_STEP;
    if (!nextPlayer) player = null;
    else if (!player || player.x !== nextPlayer.x || player.z !== nextPlayer.z || player.yaw !== nextPlayer.yaw || player.level !== nextPlayer.level || player.moving !== nextPlayer.moving) player = nextPlayer;
    if (!sameMarkers(markers, nextMarkers)) markers = nextMarkers;
    return { mapPlayer: player, mapMarkers: markers, mapZoom: Math.round(zoom * 100) / 100 };
  };
};
