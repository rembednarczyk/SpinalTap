import { type ContractLog, M0_TARGET_TAG, contractTag } from "@seki/core";
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
  for (const p of props) {
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
  return { bounds, blocks, streets: flats.filter((r) => r !== ground), ...(decks.length > 0 ? { decks } : {}), ...(links.length > 0 ? { links } : {}) };
};

/** Metres; positions are snapped to this so the store only changes when the map would. */
const SNAP = 0.25;
const ANGLE_SNAP = Math.PI / 90;
const snap = (v: number, step: number) => Math.round(v / step) * step;

const markerKind = (e: Entity, targetTags: ReadonlySet<string>): MapMarkerVm["kind"] | null => {
  if (e.interactable?.kind === "shop") return "ripperdoc";
  // Both contract givers: Kaito and Hana on the market.
  if (e.interactable?.dialogueId === "fixer" || e.interactable?.dialogueId === "hana") return "fixer";
  // The crate of a retrieval job.
  if (e.interactable?.kind === "pickup") return "target";
  if (e.tag && targetTags.has(e.tag) && (e.health?.current ?? 0) > 0) return "target";
  return null;
};

const sameMarkers = (a: readonly MapMarkerVm[], b: readonly MapMarkerVm[]) =>
  a.length === b.length && a.every((m, i) => m.id === b[i]?.id && m.x === b[i].x && m.z === b[i].z && m.kind === b[i].kind);

export interface MinimapFrame {
  readonly mapPlayer: MapPlayerVm | null;
  readonly mapMarkers: readonly MapMarkerVm[];
}

/**
 * Tracks the player and what is worth finding (contract givers, ripperdoc, current targets, a
 * contract crate). Returns the previous objects when nothing moved past the snap, so per-frame
 * syncs do not re-render.
 */
export const createMinimapTracker = () => {
  let player: MapPlayerVm | null = null;
  let markers: readonly MapMarkerVm[] = [];
  return (entities: Iterable<Entity>, flags: readonly string[], contracts: ContractLog): MinimapFrame => {
    const targetTags = new Set<string>();
    if (!flags.includes(`killed:${M0_TARGET_TAG}`)) targetTags.add(M0_TARGET_TAG);
    if (contracts.active?.status === "active") targetTags.add(contractTag(contracts.active.id));
    let nextPlayer: MapPlayerVm | null = null;
    const nextMarkers: MapMarkerVm[] = [];
    for (const e of entities) {
      if (e.player) {
        const at = { x: snap(e.position.x, SNAP), z: snap(e.position.z, SNAP), yaw: snap(e.yaw, ANGLE_SNAP) };
        nextPlayer = e.position.y > UPPER ? { ...at, level: Math.round(e.position.y) } : at;
        continue;
      }
      const kind = markerKind(e, targetTags);
      if (kind) nextMarkers.push({ id: e.key ?? `e${e.id}`, kind, x: snap(e.position.x, SNAP), z: snap(e.position.z, SNAP) });
    }
    if (!nextPlayer) player = null;
    else if (!player || player.x !== nextPlayer.x || player.z !== nextPlayer.z || player.yaw !== nextPlayer.yaw || player.level !== nextPlayer.level) player = nextPlayer;
    if (!sameMarkers(markers, nextMarkers)) markers = nextMarkers;
    return { mapPlayer: player, mapMarkers: markers };
  };
};
