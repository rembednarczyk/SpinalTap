import type { Locale } from "@seki/core";
import type { PerfSample } from "@seki/engine";
import { translate } from "@seki/ui";

/** Presenter of the map preview (ADR-0044): attribution, controls, time and the draw numbers. */
export interface PreviewOverlay {
  show(attribution: string, hour: number, perf: PerfSample, map: unknown): void;
}

/** The overlay in `locale` (the player's saved language, ADR-0056). */
export const createOverlay = (root: HTMLElement, clean: boolean, locale: Locale): PreviewOverlay => {
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;left:12px;bottom:10px;max-width:calc(100% - 24px);font:12px/1.4 'Share Tech Mono',monospace;color:#cfe6ff;text-shadow:0 0 3px #000;pointer-events:none;white-space:pre-wrap";
  root.appendChild(box);
  return {
    show(attribution, hour, perf, map) {
      if (clean) {
        box.textContent = attribution;
        return;
      }
      const m = map as { buildings?: number; near?: number; far?: number; vertices?: number; props?: { pieces: number; groups: number } | null } | null;
      const hh = String(Math.floor(hour)).padStart(2, "0");
      const stats = translate(locale, "preview.stats", {
        hour: hh,
        fps: perf.fps,
        drawCalls: perf.drawCalls,
        meshes: perf.activeMeshes,
        buildings: m?.buildings ?? 0,
        near: m?.near ?? 0,
        far: m?.far ?? 0,
        pieces: m?.props?.pieces ?? 0,
        groups: m?.props?.groups ?? 0,
        vertices: Math.round((m?.vertices ?? 0) / 1000),
      });
      box.textContent = `${stats}\n${translate(locale, "preview.help")}\n${attribution}`;
    },
  };
};
