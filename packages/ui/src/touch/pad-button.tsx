import { type PointerEvent as ReactPointerEvent, type ReactNode, useRef, useState } from "react";
import type { TouchButton, TouchPadSink } from "./touch-pad-sink";

/** Radians of rotation per CSS pixel of finger travel. */
const LOOK_SENSITIVITY = 0.0055;

interface Drag {
  id: number;
  x: number;
  y: number;
}

/** Drag-to-look handlers, shared by the look zone and the fire button. */
export const useLookDrag = (pad: TouchPadSink) => {
  const last = useRef<Drag | null>(null);
  return {
    start(e: ReactPointerEvent) {
      last.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    },
    move(e: ReactPointerEvent) {
      const l = last.current;
      if (!l || l.id !== e.pointerId) return;
      pad.look((e.clientX - l.x) * LOOK_SENSITIVITY, (e.clientY - l.y) * LOOK_SENSITIVITY);
      last.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    },
    end(e: ReactPointerEvent) {
      if (last.current?.id === e.pointerId) last.current = null;
    },
  };
};

/** Swallows the long-press menu and the compatibility click of a touch button. */
export const touchGuards = {
  onContextMenu: (e: { preventDefault(): void }) => e.preventDefault(),
  // When the press opens a dialogue, the pad hides and the click would land on whatever appeared
  // under the thumb (the first dialogue choice).
  onTouchEnd: (e: { preventDefault(): void }) => e.preventDefault(),
};

/** A button of the virtual pad: held while the finger is down. */
export const PadButtonView = ({
  pad,
  button,
  label,
  hint,
  className,
  lookToo = false,
  testId,
}: {
  pad: TouchPadSink;
  button: TouchButton;
  label: ReactNode;
  hint: string;
  className: string;
  lookToo?: boolean;
  testId?: string;
}) => {
  const look = useLookDrag(pad);
  const [down, setDown] = useState(false);
  const up = (e: ReactPointerEvent) => {
    setDown(false);
    pad.release(button);
    look.end(e);
  };
  return (
    <button
      type="button"
      aria-label={hint}
      data-testid={testId}
      className={`touch__btn ${className}${down ? " touch__btn--down" : ""}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setDown(true);
        pad.press(button);
        if (lookToo) look.start(e);
      }}
      onPointerMove={(e) => lookToo && look.move(e)}
      onPointerUp={up}
      onPointerCancel={up}
      {...touchGuards}
    >
      {label}
    </button>
  );
};
