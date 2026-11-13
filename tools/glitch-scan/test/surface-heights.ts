/**
 * The surface model under each building of `stare-miasto-1-1` (G-708, T-269): NMPT GUGiK 0.5 m,
 * the median of the surface in the game's outline as world y (heights less 196.15 m), sampled every
 * 0.5 m (12.11). Medians of the whole outline, yards and neighbours' eaves included, so the check
 * is apart from the import's correction, which takes the roof cells alone. The 55 buildings' middles
 * of the roof lie at +0.22 m (median) of it; Rybna 13 and two by Zaułek Panasa stood 8.7-11.4 m over.
 */

export const BUILDING_SURFACE: Readonly<Record<string, number>> = {
  w61102109: -6.2,
  w66293264: 7.9,
  w66293276: 0.1, // Rybna 13: low roofs and a yard
  w66293292: 3.7,
  w66293296: 7.1,
  w66293302: 8.8,
  w66293304: 9.0,
  w66293322: -7.4,
  w66293331: -2.2,
  w66293334: 0.1,
  w66293344: 6.5,
  w66293345: 5.6,
  w66293349: 4.6,
  w66293353: -2.7,
  w66293360: 8.1,
  w66293361: 8.4,
  w66293362: 8.2,
  w66293364: 7.3,
  w66293366: 10.4,
  w66293367: 8.1,
  w66293368: 10.3,
  w66293369: 9.7,
  w66293395: 12.0,
  w66293406: 9.2,
  w66293533: 10.5,
  w66293560: 12.9,
  w66293566: 13.7,
  w66293580: 13.9,
  w66293614: 12.8,
  w66293636: 13.3,
  w66293640: 13.3,
  w66293653: 17.5,
  w66293665: 10.4,
  w66293720: 12.0,
  w66309802: -7.8,
  w66309803: -4.7,
  w66309804: -3.7,
  w66309805: -2.4,
  w66309807: -2.6,
  w66309813: -8.0,
  w106936650: -20.8,
  w179264854: 10.8,
  w232362876: 0.2,
  w232362891: 16.5,
  w232362895: 7.2,
  w232362917: 11.0,
  w232362919: 9.6,
  w232362965: -8.9, // Zaułek Panasa, the beer garden's terrace at the level of Grodzka's yards
  w364575978: -7.3, // Zaułek Panasa, by the terrace
  w435925645: 8.5,
  w598840139: -7.7,
  w1348806694: 6.6,
  r3119721: 10.7,
  r18246399: 14.8,
  r18246401: 12.3,
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
