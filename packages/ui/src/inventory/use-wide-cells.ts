import { useEffect, useState } from "react";

/**
 * Where the bag's cells grow to 72 px and keep their names under the icons: the desktop layout
 * of `styles.css` (`@media (min-width: 1100px) and (min-height: 620px)`). Below it, on a phone,
 * a 52 px cell shows only its icon and the name waits in the details (ADR-0073 stage 2).
 */
export const WIDE_CELLS = { width: 1100, height: 620 } as const;

const wideNow = (): boolean => window.innerWidth >= WIDE_CELLS.width && window.innerHeight >= WIDE_CELLS.height;

/** Whether the window has room for named cells, following resizes and turns of a phone. */
export const useWideCells = (): boolean => {
  const [wide, setWide] = useState(wideNow);
  useEffect(() => {
    const update = () => setWide(wideNow());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return wide;
};
