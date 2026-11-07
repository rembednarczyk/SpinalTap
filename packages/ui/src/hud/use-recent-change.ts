import { useEffect, useRef, useState } from "react";

/**
 * True for `ms` after `value` changes (never for the value it mounts with): the HUD keeps a calm
 * block on screen a moment after XP comes in, and flashes the bar after a level up.
 */
export const useRecentChange = (value: number, ms: number): boolean => {
  const first = useRef(value);
  const [recent, setRecent] = useState(false);
  useEffect(() => {
    if (value === first.current) return;
    first.current = value;
    setRecent(true);
    const timer = setTimeout(() => setRecent(false), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return recent;
};
