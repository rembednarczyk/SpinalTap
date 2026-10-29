import { type PointerEvent, type WheelEvent, useCallback, useRef, useState } from "react";

/** What the map tab shows: the centre and the width of the view, metres. */
export interface CityMapView {
  readonly x: number;
  readonly z: number;
  readonly span: number;
}

export const MIN_SPAN = 120;
export const MAX_SPAN = 2400;
const STEP = 1.5;

const clampSpan = (span: number) => Math.min(MAX_SPAN, Math.max(MIN_SPAN, span));

/** Zooms by `factor` (above 1 out, below 1 in), keeping the centre. */
export const zoomView = (v: CityMapView, factor: number): CityMapView => ({ ...v, span: clampSpan(v.span * factor) });

/** Moves the view by a drag of (dx, dy) pixels on a map `width` pixels wide. */
export const panView = (v: CityMapView, dx: number, dy: number, width: number): CityMapView => {
  const k = v.span / Math.max(1, width);
  return { ...v, x: v.x - dx * k, z: v.z + dy * k };
};

/**
 * Pan and zoom of the map tab: drag with the mouse or a finger, the wheel or the buttons zoom,
 * `centre` jumps (to the player, to a district). Local to the tab: nothing goes to the app.
 */
export const useMapView = (initial: CityMapView) => {
  const [view, setView] = useState(initial);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const zoom = useCallback((factor: number) => setView((v) => zoomView(v, factor)), []);
  const centre = useCallback((x: number, z: number) => setView((v) => ({ ...v, x, z })), []);
  const onPointerDown = useCallback((e: PointerEvent<SVGSVGElement>) => {
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);
  const onPointerMove = useCallback((e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    // The view is `span` across the shorter side (the SVG meets its box).
    const width = Math.min(e.currentTarget.clientWidth, e.currentTarget.clientHeight || e.currentTarget.clientWidth);
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    setView((v) => panView(v, dx, dy, width));
  }, []);
  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);
  const onWheel = useCallback((e: WheelEvent<SVGSVGElement>) => zoom(e.deltaY > 0 ? STEP : 1 / STEP), [zoom]);
  return { view, zoomIn: () => zoom(1 / STEP), zoomOut: () => zoom(STEP), centre, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onWheel } };
};
