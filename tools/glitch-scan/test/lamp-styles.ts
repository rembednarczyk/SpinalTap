import { SpatialHash } from "../../../packages/core/src/math/spatial-hash";

/**
 * Lamps of two looks side by side (G-259): a plain town lamp (a road lamp, a modern pole) standing
 * by a styled one (a pastoral, a candelabrum, a wall lantern) doubles the light point, and where
 * Lublin set its styled lamps (the deptak, the old town) the plain one should not be there at all.
 */
type Lamp = { readonly prop: string; readonly x: number; readonly z: number };

const PLAIN: ReadonlySet<string> = new Set(["lamp-road", "lamp-modern-pole"]);
const STYLED: ReadonlySet<string> = new Set(["lamp-pastoral", "lamp-candelabra", "lamp-wall-lantern"]);

/** Every plain lamp nearer than `reach` metres to a styled one, with that distance. */
export const plainLampsByStyled = (props: readonly Lamp[], reach: number): { readonly at: string; readonly what: string }[] => {
  const styled = props.filter((i) => STYLED.has(i.prop));
  return props
    .filter((i) => PLAIN.has(i.prop))
    .flatMap((i) => {
      const by = styled.find((s) => Math.hypot(s.x - i.x, s.z - i.z) < reach);
      return by ? [{ at: `${i.x.toFixed(0)},${i.z.toFixed(0)}`, what: `${i.prop} ${Math.hypot(by.x - i.x, by.z - i.z).toFixed(1)} m from ${by.prop}` }] : [];
    });
};

/** The side of the cells the lamps are filed in (m). */
const CELL = 32;

type Way = { readonly id: number; readonly pts: readonly { readonly x: number; readonly z: number }[] };

/**
 * Every way along which the lamps change look (G-266): plain and styled lamps both within
 * `reach` metres of its axis, away from its ends by `endGap` (where the side streets' lamps
 * stand at their mouths). One OSM way is one street of one kind, lit one way.
 */
export const mixedLampWays = (ways: readonly Way[], props: readonly Lamp[], reach: number, endGap: number): { readonly at: string; readonly what: string }[] => {
  // The lamps in core's `SpatialHash` of `CELL` m (G-409): a way asks only those within `reach` of
  // its points' bounds, in the props' order, instead of every lamp of the city.
  const lamps = props.filter((i) => PLAIN.has(i.prop) || STYLED.has(i.prop));
  const cells = new SpatialHash<Lamp>(CELL);
  for (const i of lamps) cells.insertPoint(i, i.x, i.z);
  // A metre over the reach, past any rounding of the bounds.
  const room = reach + 1;
  const near = (pts: readonly { readonly x: number; readonly z: number }[]): Lamp[] => {
    if (pts.length === 0) return [];
    const [x0, x1] = [Math.min(...pts.map((p) => p.x)) - room, Math.max(...pts.map((p) => p.x)) + room];
    const [z0, z1] = [Math.min(...pts.map((p) => p.z)) - room, Math.max(...pts.map((p) => p.z)) + room];
    return cells.query(x0, z0, x1, z1);
  };
  return ways.flatMap((w) => {
    const inner = w.pts.filter((p) => Math.hypot(p.x - w.pts[0]!.x, p.z - w.pts[0]!.z) > endGap && Math.hypot(p.x - w.pts[w.pts.length - 1]!.x, p.z - w.pts[w.pts.length - 1]!.z) > endGap);
    const along = near(inner).filter((i) => inner.some((p) => Math.hypot(p.x - i.x, p.z - i.z) < reach));
    const plain = along.filter((i) => PLAIN.has(i.prop));
    const styled = along.length - plain.length;
    return plain.length > 0 && styled > 0 ? [{ at: `${plain[0]!.x.toFixed(0)},${plain[0]!.z.toFixed(0)}`, what: `w${w.id}: ${plain.length} plain and ${styled} styled lamps` }] : [];
  });
};

/** Every plain lamp inside the walled Old Town (G-264), where the city's lamps are styled. */
export const plainLampsIn = (props: readonly Lamp[], inside: (p: { readonly x: number; readonly z: number }) => boolean): { readonly at: string; readonly what: string }[] =>
  props.filter((i) => PLAIN.has(i.prop) && inside(i)).map((i) => ({ at: `${i.x.toFixed(0)},${i.z.toFixed(0)}`, what: `${i.prop} in the Old Town` }));
