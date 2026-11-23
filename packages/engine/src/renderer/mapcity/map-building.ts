import type { BuildingPassage, EntityId, Vec3, ViewDescriptor } from "@seki/core";
import { MEMORIAL_CLEAR, REMEMBRANCE_PLACES, type RemembrancePlace } from "@seki/sim";
import { SPAN_MAX } from "./canyon-plan";
import type { MapBuilding, WorldPassage } from "./facade-frame";
import { type MappedCanopy, bellTowersAt, canopyAt, towerAt, wallAt } from "./landmarks/match";
import { type P2, boundsOf, centroid, pointInRing } from "./polygon";

/** A building view of the map city, with its clean ring in world metres. */
export interface BuildingSource {
  readonly ring: readonly P2[];
  readonly view: Extract<ViewDescriptor, { kind: "building" }>;
  readonly at: Vec3;
}

/** A passage of a building view in world metres (ADR-0048). */
const worldPassage = (p: BuildingPassage, at: Vec3): WorldPassage => ({
  from: { x: p.from.x + at.x, z: p.from.z + at.z },
  to: { x: p.to.x + at.x, z: p.to.z + at.z },
  width: p.width,
  floor: [p.floor[0] + at.y, p.floor[1] + at.y],
  spring: p.spring + at.y,
  crown: p.crown + at.y,
});

/** A part of it from the map (a nave, a turret, G-049) stands on it as a building lifted onto it. */
const carriesPart = (e: BuildingSource, around: Iterable<BuildingSource>): boolean => {
  if (e.view.soffit !== undefined) return false;
  for (const o of around) if (o !== e && o.view.soffit !== undefined && pointInRing(centroid(o.ring), e.ring)) return true;
  return false;
};

/**
 * The places of remembrance its signs may reach (ADR-0074 §6, G-943): the signs on its walls, and
 * the billboards and curtains over the street, which hang up to `SPAN_MAX` off them.
 */
export const remembranceNear = (ring: readonly P2[], places: readonly RemembrancePlace[] = REMEMBRANCE_PLACES): RemembrancePlace[] => {
  const b = boundsOf(ring);
  const reach = MEMORIAL_CLEAR + SPAN_MAX;
  return places.filter((r) => Math.hypot(Math.max(r.x0 - b.maxX, 0, b.minX - r.x1), Math.max(r.z0 - b.maxZ, 0, b.minZ - r.z1)) < reach);
};

/**
 * The measured building of a view (ADR-0044). The entity stands at the foot of its outline; on a
 * slope the bottom `plinth` metres are a plinth, so the ground floor (and the window grid)
 * starts above it. A footbridge (ADR-0048) keeps the street as its ground floor and draws from
 * its soffit up. `heightAt` is the terrain under a point, or null outside it; `around` are the
 * buildings near it, for the parts lifted onto it.
 */
const canopyOf = (c: MappedCanopy | null): { canopy?: MappedCanopy } => (c ? { canopy: c } : {});

export const mapBuilding = (id: EntityId, e: BuildingSource, heightAt: (x: number, z: number) => number | null, around: Iterable<BuildingSource> = []): MapBuilding => {
  const v = e.view;
  const base = e.at.y;
  const towers = bellTowersAt(e.at.x, e.at.z, v.outline.length);
  const quiet = remembranceNear(e.ring);
  const plinth = v.soffit !== undefined ? 0 : Math.min(Math.max(v.plinth ?? 0, 0), v.height - 2);
  let foot = v.soffit !== undefined ? base + Math.min(Math.max(v.soffit, 0), v.height - 1) : base;
  if (v.soffit === undefined) for (const p of e.ring) foot = Math.min(foot, heightAt(p.x, p.z) ?? base);
  return {
    id,
    ring: e.ring,
    base: base + plinth,
    foot,
    height: v.height - plinth,
    levels: v.levels,
    use: v.use,
    look: v.look,
    ...(v.roof !== undefined ? { roof: v.roof } : {}),
    ...(v.roofShape ? { roofShape: v.roofShape } : {}),
    ...(v.roofAcross ? { roofAcross: true } : {}),
    ...(v.name ? { name: v.name } : {}),
    shopfront: v.shopfront === true,
    ...(v.doorways?.length ? { doorways: v.doorways.map((d) => ({ x: d.at.x + e.at.x, z: d.at.z + e.at.z, width: d.width, bottom: d.bottom + e.at.y, top: d.top + e.at.y })) } : {}),
    ...(v.passages?.length ? { passages: v.passages.map((p) => worldPassage(p, e.at)) } : {}),
    ...(v.soffit !== undefined ? { lifted: true } : {}),
    ...canopyOf(v.soffit !== undefined ? canopyAt(e.at.x, e.at.z, v.outline.length) : null),
    ...(carriesPart(e, around) ? { carriesParts: true } : {}),
    ...(towers.length > 0 ? { towers } : {}),
    ...(towerAt(e.at.x, e.at.z, v.outline.length) ? { freeTower: true } : {}),
    ...wallAt(e.at.x, e.at.z, v.outline.length),
    ...(v.signs === "bracket" ? { bracketSigns: true } : {}),
    ...(v.vertical ? { rise: Math.max(0, v.vertical.rise), clutter: Math.min(1, Math.max(0, v.vertical.clutter)) } : {}),
    ...(v.vertical?.shopfronts ? { shopfronts: true as const } : {}),
    ...(v.venues?.length ? { venues: v.venues.map((u) => ({ x: u.at.x + e.at.x, z: u.at.z + e.at.z, name: u.name, color: u.color })) } : {}),
    ...(quiet.length > 0 ? { remembrance: quiet } : {}),
    ...(v.vertical?.landmarks?.length ? { landmarks: v.vertical.landmarks.map((l) => ({ ring: l.outline.map((p) => ({ x: p.x + e.at.x, z: p.z + e.at.z })), top: l.top + e.at.y })) } : {}),
  };
};
