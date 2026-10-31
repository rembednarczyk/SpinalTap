import type { BuildingPassage, EntityId, Vec3, ViewDescriptor } from "@seki/core";
import type { MapBuilding, WorldPassage } from "./facade-frame";
import { type P2, centroid, pointInRing } from "./polygon";

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
 * The measured building of a view (ADR-0044). The entity stands at the foot of its outline; on a
 * slope the bottom `plinth` metres are a plinth, so the ground floor (and the window grid)
 * starts above it. A footbridge (ADR-0048) keeps the street as its ground floor and draws from
 * its soffit up. `heightAt` is the terrain under a point, or null outside it; `around` are the
 * buildings near it, for the parts lifted onto it.
 */
export const mapBuilding = (id: EntityId, e: BuildingSource, heightAt: (x: number, z: number) => number | null, around: Iterable<BuildingSource> = []): MapBuilding => {
  const v = e.view;
  const base = e.at.y;
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
    ...(carriesPart(e, around) ? { carriesParts: true } : {}),
    ...(v.signs === "bracket" ? { bracketSigns: true } : {}),
    ...(v.vertical ? { rise: Math.max(0, v.vertical.rise), clutter: Math.min(1, Math.max(0, v.vertical.clutter)) } : {}),
    ...(v.vertical?.landmarks?.length ? { landmarks: v.vertical.landmarks.map((l) => ({ ring: l.outline.map((p) => ({ x: p.x + e.at.x, z: p.z + e.at.z })), top: l.top + e.at.y })) } : {}),
  };
};
