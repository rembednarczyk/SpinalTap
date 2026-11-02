/**
 * Landmarks of the curator's list whose height the importer made up (G-204): no `height` and no
 * `building:levels` in the map or its corrections, so the walls are the district's default
 * storeys, and the silhouette the player knows the place by is a guess.
 */

interface LandmarkBuilding {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly source: "height" | "levels" | "default";
  readonly name?: string;
}

/** Each listed landmark (by map id, a split piece by its whole's) standing at a default height. */
export const landmarksAtDefaultHeight = (ids: readonly string[], buildings: readonly LandmarkBuilding[]): { readonly at: string; readonly what: string }[] => {
  const listed = new Set(ids);
  return buildings
    .filter((b) => b.source === "default" && listed.has(b.id.split("/")[0]!))
    .map((b) => ({ at: `${b.x.toFixed(0)},${b.z.toFixed(0)}`, what: `${b.id} ${b.name ?? ""}`.trim() }));
};
