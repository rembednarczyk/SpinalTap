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

interface MapTower {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly tags: Readonly<Record<string, string>>;
}

/**
 * Each tower the map draws round an outline of its own (`man_made=tower`) that the game has no
 * building of, its own or a split piece of it (G-098): a bell tower mapped without `building`,
 * left out of the import with the silhouette it gives its church.
 */
export const towersSkipped = (towers: readonly MapTower[], built: ReadonlySet<string>): { readonly at: string; readonly what: string }[] =>
  towers
    .filter((t) => t.tags["man_made"] === "tower" && !built.has(t.id))
    .map((t) => ({ at: `${t.x.toFixed(0)},${t.z.toFixed(0)}`, what: `${t.id} ${t.tags["tower:type"] ?? t.tags["man_made"]}` }));

interface ChurchBuilding extends LandmarkBuilding {
  readonly use: string;
  readonly y: number;
  readonly height: number;
  readonly roof?: number;
}

/**
 * NMPT GUGiK 0.5 m (2.11, T-122), world y: the eaves and the ridge of each church's main body
 * where the surface over its outline is a roof (a plateau, under 1 m off a plane in 3 x 3 m
 * blocks), not tree crowns. Towers, spires and lower annexes are left out. The same survey
 * feeds the corrections in `corrections.ts`, so this check catches a wrong height/roof sum, the
 * plinth and any church left at the default height, but not a wrong measurement; it only looks
 * upwards (a church too low is caught by the corrections test, within 1 m).
 */
export const CHURCH_SURFACE: Readonly<Record<string, { readonly eaves: number; readonly ridge: number }>> = {
  w69916021: { eaves: 6.8, ridge: 11.4 }, // cerkiew św. Jozafata, its tower w1382552285 to y 9.5
  w66330578: { eaves: 12.5, ridge: 24.5 }, // Bernardyni, nave (tower to y 39 apart)
  w66264082: { eaves: 11.5, ridge: 22 }, // Brygidki, nave (tower to y 32 apart)
  w66264126: { eaves: 16.5, ridge: 20.4 }, // Świętego Ducha, nave (tower to y 26.5 apart)
  w232674421: { eaves: 1.2, ridge: 1.8 }, // Niecała 4, a low building in the yard
  r5420467: { eaves: 5, ridge: 14.5 }, // Karmelici: wings' eaves, the church's ridge
  w66335226: { eaves: 12.5, ridge: 19.7 }, // św. Piotra, nave (façade's gable to y 20.9)
  w66258180: { eaves: 8.5, ridge: 12.5 }, // św. Mikołaja, nave away from the trees
  w66264148: { eaves: -7, ridge: -4.3 }, // cerkiew Przemienienia, nave (belfry to y 6.5 apart)
};

/** How far over the surface model a church's eaves or ridge may stand: the measurement's spread. */
const OVER = 1.5;

/**
 * Each church (by map id, a split piece by its whole's) whose height nothing bears out (G-216):
 * at the default height with no measurement of its roof, or with its eaves or ridge clearly over
 * the measured roof.
 */
export const churchesOverSurface = (
  surface: Readonly<Record<string, { readonly eaves: number; readonly ridge: number }>>,
  buildings: readonly ChurchBuilding[],
): { readonly at: string; readonly what: string }[] =>
  buildings.flatMap((b) => {
    if (b.use !== "church") return [];
    const s = surface[b.id.split("/")[0]!];
    const eaves = b.y + b.height;
    const ridge = eaves + (b.roof ?? 0);
    const over = s ? eaves > s.eaves + OVER || ridge > s.ridge + OVER : b.source === "default";
    if (!over) return [];
    const why = s ? `eaves ${eaves.toFixed(1)}/${s.eaves}, ridge ${ridge.toFixed(1)}/${s.ridge}` : "default, unmeasured";
    return [{ at: `${b.x.toFixed(0)},${b.z.toFixed(0)}`, what: `${b.id} ${b.name ?? ""} ${why}`.replace(/\s+/g, " ") }];
  });
