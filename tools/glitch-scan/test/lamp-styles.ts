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

/** Every plain lamp inside the walled Old Town (G-264), where the city's lamps are styled. */
export const plainLampsIn = (props: readonly Lamp[], inside: (p: { readonly x: number; readonly z: number }) => boolean): { readonly at: string; readonly what: string }[] =>
  props.filter((i) => PLAIN.has(i.prop) && inside(i)).map((i) => ({ at: `${i.x.toFixed(0)},${i.z.toFixed(0)}`, what: `${i.prop} in the Old Town` }));
