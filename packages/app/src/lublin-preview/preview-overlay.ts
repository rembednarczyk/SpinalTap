import type { PerfSample } from "@seki/engine";

/** Presenter of the map preview (ADR-0044): attribution, controls, time and the draw numbers. */
export interface PreviewOverlay {
  show(attribution: string, hour: number, perf: PerfSample, map: unknown): void;
}

const HELP = "przeciągnij: obrót · kółko: zoom · WASD/strzałki: przesuń · Q/E: w dół/w górę · Shift: szybciej · N: noc/dzień · 1-5: ujęcia";

export const createOverlay = (root: HTMLElement, clean: boolean): PreviewOverlay => {
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
      box.textContent = `Lublin 2077, podgląd mapy · ${hh}:00 · ${perf.fps} fps · ${perf.drawCalls} wywołań · ${perf.activeMeshes} siatek · budynki ${m?.buildings ?? 0} (blisko ${m?.near ?? 0} / daleko ${m?.far ?? 0} komórek) · meble ${m?.props?.pieces ?? 0} (${m?.props?.groups ?? 0} siatek) · ${Math.round((m?.vertices ?? 0) / 1000)}k wierzchołków\n${HELP}\n${attribution}`;
    },
  };
};
