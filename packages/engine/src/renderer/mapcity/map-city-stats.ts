import type { Mesh } from "../../babylon";
import { type Cell, cellMeshes } from "./map-cells";
import type { MapEntries } from "./map-entries";
import type { StreetProps, StreetPropsStats } from "./street-props";

export interface MapCityStats {
  readonly buildings: number;
  readonly grounds: number;
  readonly terrains: number;
  readonly cells: number;
  readonly near: number;
  readonly far: number;
  readonly vertices: number;
  /** Street furniture (ADR-0047), null before the first `street-props` view. */
  readonly props: StreetPropsStats | null;
}

/** What the map city holds and draws (debug and tests). */
export const mapCityStats = (cells: ReadonlyMap<string, Cell>, entries: MapEntries, street: StreetProps | null): MapCityStats => {
  let near = 0;
  let far = 0;
  let vertices = 0;
  for (const c of cells.values()) {
    if (c.lod === "near") near++;
    else if (c.lod === "far") far++;
    for (const m of cellMeshes(c)) if (m) vertices += m.getTotalVertices();
  }
  for (const t of entries.terrains.values()) vertices += t.mesh?.getTotalVertices() ?? 0;
  return { buildings: entries.buildings.size, grounds: entries.grounds.size, terrains: entries.terrains.size, cells: cells.size, near, far, vertices, props: street?.stats ?? null };
};

/** Every mesh the map city has built (debug and tests). */
export const mapCityMeshes = (cells: ReadonlyMap<string, Cell>, entries: MapEntries, street: StreetProps | null): Mesh[] => {
  const out: Mesh[] = [];
  for (const c of cells.values()) for (const m of cellMeshes(c)) if (m) out.push(m);
  for (const t of entries.terrains.values()) if (t.mesh) out.push(t.mesh);
  out.push(...(street?.meshes ?? []));
  return out;
};
