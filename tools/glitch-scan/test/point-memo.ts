/**
 * A height of the map remembered by the exact point (G-409): a check that asks the simulation's
 * surface at the same points again and again (a cable's ribbons share their lines) asks it once,
 * and under coverage each call costs most of the check's time. The function must be pure; the
 * answers are the same to the bit.
 */
export const memoAt = (f: (x: number, z: number) => number): ((x: number, z: number) => number) => {
  const rows = new Map<number, Map<number, number>>();
  return (x, z) => {
    let row = rows.get(x);
    if (!row) rows.set(x, (row = new Map()));
    let y = row.get(z);
    if (y === undefined) row.set(z, (y = f(x, z)));
    return y;
  };
};
