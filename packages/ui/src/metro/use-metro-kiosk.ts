import { useEffect } from "react";
import type { MetroStationId } from "@seki/core";
import type { MetroMapVm } from "../store/metro-vm";
import { useMetroIntents } from "../use-ui";

/** The next destination along the list from `selected` (skipping the platform the player is on), or null at the end. */
export const stepStop = (map: MetroMapVm, dir: 1 | -1): MetroStationId | null => {
  const open = map.stops.filter((s) => !s.here);
  if (open.length === 0) return null;
  const at = map.selected === null ? -1 : open.findIndex((s) => s.id === map.selected);
  if (at < 0) return (dir === 1 ? open[0] : open[open.length - 1])?.id ?? null;
  return open[at + dir]?.id ?? null;
};

/**
 * The kiosk's keys (ADR-0071): the arrows choose the destination (the first step), Esc and E
 * leave as before. The ticket is the button's, so a key never buys one by accident.
 */
export const useMetroKioskKeys = (map: MetroMapVm | null): void => {
  const intents = useMetroIntents();
  useEffect(() => {
    if (!map) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" || e.code === "KeyE") {
        intents.closeMetro();
        return;
      }
      const dir = e.code === "ArrowDown" || e.code === "ArrowRight" ? 1 : e.code === "ArrowUp" || e.code === "ArrowLeft" ? -1 : 0;
      if (dir === 0) return;
      e.preventDefault();
      const next = stepStop(map, dir);
      if (next) intents.selectMetroStop(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [map, intents]);
};
