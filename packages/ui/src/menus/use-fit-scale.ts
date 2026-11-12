import { type RefObject, useLayoutEffect } from "react";

/** The smallest scale the menu may take: below it the text would be unreadable. */
export const MIN_FIT_SCALE = 0.6;

/**
 * The scale at which a bar `natural` px wide fits into `room` px: 1 when it fits as it is,
 * smaller when it does not, never below {@link MIN_FIT_SCALE}.
 */
export const fitScale = (room: number, natural: number): number => {
  if (!(room > 0) || !(natural > 0) || natural <= room) return 1;
  return Math.max(MIN_FIT_SCALE, Math.floor((room / natural) * 1000) / 1000);
};

/**
 * Scales the whole `frame` down (CSS `zoom`) so that its `bar` fits its width: a long row of
 * ammo kinds in the top bar used to push the close button off the screen. The scale is measured
 * at 1 on every change of `key` and on every resize of the window, so it also grows back. If the
 * bar does not fit even at {@link MIN_FIT_SCALE}, the frame is marked `data-squeezed` and the ammo
 * row is clipped instead of the close button.
 */
export const useFitScale = (frame: RefObject<HTMLElement | null>, bar: RefObject<HTMLElement | null>, key: string): void => {
  useLayoutEffect(() => {
    const f = frame.current;
    const b = bar.current;
    if (!f || !b) return;
    const fit = () => {
      f.style.removeProperty("zoom");
      delete f.dataset.squeezed;
      const room = f.clientWidth;
      const natural = b.scrollWidth;
      const scale = fitScale(room, natural);
      if (scale < 1) f.style.setProperty("zoom", String(scale));
      f.dataset.scale = String(scale);
      // Still too wide at the smallest scale: the ammo row gives way, the close button stays.
      if (natural * scale > room) f.dataset.squeezed = "";
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [frame, bar, key]);
};
