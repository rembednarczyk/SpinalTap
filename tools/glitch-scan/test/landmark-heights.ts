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

/**
 * Each tower of the map (`man_made=tower` or a `tower:type`) with no `height`, `building:height`
 * or `building:levels` in its tags that the game stands at a default height (G-224): a church's
 * belfry one storey high, or a tower over its church's ridge. A measured correction (or a height
 * mapped later) takes it off the default.
 */
export const towersAtDefaultHeight = (
  buildings: readonly LandmarkBuilding[],
  tagsOf: (id: string) => Readonly<Record<string, string>>,
): { readonly at: string; readonly what: string }[] =>
  buildings.flatMap((b) => {
    const t = tagsOf(b.id);
    const tower = t["man_made"] === "tower" || t["tower:type"] !== undefined;
    const sized = t["height"] !== undefined || t["building:height"] !== undefined || t["building:levels"] !== undefined;
    if (!tower || sized || b.source !== "default") return [];
    return [{ at: `${b.x.toFixed(0)},${b.z.toFixed(0)}`, what: `${b.id} ${t["tower:type"] ?? t["man_made"] ?? ""}`.trim() }];
  });
