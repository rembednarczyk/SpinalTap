import { useEffect, useRef } from "react";
import type { PreviewRect } from "../intents";
import { useCharacterIntents } from "../use-ui";

/** Radians of turn per CSS pixel dragged. */
export const PREVIEW_TURN_PER_PX = 0.012;
/** A second tap within this time and distance turns the character back to the front. */
const DOUBLE_TAP_MS = 320;
const TAP_SLOP_PX = 10;

const rectOf = (el: HTMLElement): PreviewRect | null => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, width: r.width, height: r.height } : null;
};

/**
 * Host of the 3D preview (plan §8.5): an empty, see-through box. The app draws the character
 * into the canvas under it, at the rectangle this sends whenever the box moves or resizes.
 * One finger or the mouse turns the character; a double tap brings it back to the front.
 */
export const CharacterPreview = () => {
  const intents = useCharacterIntents();
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; startX: number; startY: number; moved: boolean } | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let last: PreviewRect | null = null;
    const send = () => {
      const r = rectOf(el);
      const same = r && last && r.x === last.x && r.y === last.y && r.width === last.width && r.height === last.height;
      if (same || (r === null && last === null)) return;
      last = r;
      intents.setPreviewViewport(r);
    };
    send();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(send);
    observer?.observe(el);
    // Rotating the phone or resizing the window can move the box without resizing it.
    window.addEventListener("resize", send);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", send);
      intents.setPreviewViewport(null);
    };
  }, [intents]);

  return (
    <div
      ref={box}
      className="preview"
      data-testid="character-preview"
      role="img"
      aria-label="Podgląd postaci. Przeciągnij, żeby obrócić, stuknij dwa razy, żeby wrócić do przodu."
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drag.current = { id: e.pointerId, x: e.clientX, startX: e.clientX, startY: e.clientY, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        const dx = e.clientX - d.x;
        if (dx === 0) return;
        d.x = e.clientX;
        if (Math.abs(e.clientX - d.startX) > TAP_SLOP_PX || Math.abs(e.clientY - d.startY) > TAP_SLOP_PX) d.moved = true;
        intents.rotatePreview(dx * PREVIEW_TURN_PER_PX);
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        drag.current = null;
        if (d.moved) {
          lastTap.current = null;
          return;
        }
        const now = performance.now();
        const prev = lastTap.current;
        if (prev && now - prev.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < TAP_SLOP_PX * 2) {
          lastTap.current = null;
          intents.resetPreview();
        } else {
          lastTap.current = { t: now, x: e.clientX, y: e.clientY };
        }
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    />
  );
};
