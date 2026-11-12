/**
 * Buildings standing over the surface model (G-708, T-269): NMPT GUGiK 0.5 m, the median of the
 * surface in the game's outline as world y (heights less 196.15 m), measured in the curator's
 * pass of `stare-miasto-1-1` (12.11). The 52 other buildings of the cell lie at +0.24 m (median)
 * and +1.0 m (p90) of it; these stood 8.7-11.4 m over it. Medians of the whole outline, yards and
 * neighbours' eaves included, so the check is apart from the import's correction, which takes the
 * roof cells alone.
 */

export const BUILDING_SURFACE: Readonly<Record<string, number>> = {
  w66293276: 0.1, // Rybna 13: low roofs and a yard
  w232362965: -8.9, // Zaułek Panasa, the beer garden's terrace at the level of Grodzka's yards
  w364575978: -7.3, // Zaułek Panasa, by the terrace
};

/** How far the middle of the roof may stand over the median of the surface, metres (the curator's threshold). */
export const SURFACE_OVER = 4;

interface Building {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly y: number;
  readonly height: number;
  readonly roof?: number;
}

/** Each measured building (a split piece by its whole's id) whose middle of the roof stands over `SURFACE_OVER` above the surface. */
export const buildingsOverSurface = (surface: Readonly<Record<string, number>>, buildings: readonly Building[]): { readonly at: string; readonly what: string }[] =>
  buildings.flatMap((b) => {
    const s = surface[b.id.split("/")[0]!];
    const middle = b.y + b.height + (b.roof ?? 0) / 2;
    if (s === undefined || middle <= s + SURFACE_OVER) return [];
    return [{ at: `${b.x.toFixed(0)},${b.z.toFixed(0)}`, what: `${b.id}: middle of the roof y ${middle.toFixed(1)}, surface y ${s}` }];
  });
