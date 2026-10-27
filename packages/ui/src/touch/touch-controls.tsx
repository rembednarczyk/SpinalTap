import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { useIntents, useUi } from "../use-ui";
import type { TouchButton, TouchPadSink } from "./touch-pad-sink";

/** Radians of rotation per CSS pixel of finger travel. */
const LOOK_SENSITIVITY = 0.0055;
const STICK_RADIUS = 56;

interface Drag {
  id: number;
  x: number;
  y: number;
}

/** Floating stick: appears where the left thumb lands. */
const Stick = ({ pad }: { pad: TouchPadSink }) => {
  const [origin, setOrigin] = useState<Drag | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const end = () => {
    setOrigin(null);
    setKnob({ x: 0, y: 0 });
    pad.setStick(0, 0);
  };

  return (
    <div
      className="touch__stick-zone"
      data-testid="touch-stick"
      onPointerDown={(e) => {
        if (origin) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setOrigin({ id: e.pointerId, x: e.clientX, y: e.clientY });
      }}
      onPointerMove={(e) => {
        if (!origin || e.pointerId !== origin.id) return;
        let dx = e.clientX - origin.x;
        let dy = e.clientY - origin.y;
        const len = Math.hypot(dx, dy);
        if (len > STICK_RADIUS) {
          dx = (dx / len) * STICK_RADIUS;
          dy = (dy / len) * STICK_RADIUS;
        }
        setKnob({ x: dx, y: dy });
        pad.setStick(dx / STICK_RADIUS, -dy / STICK_RADIUS);
      }}
      onPointerUp={(e) => origin?.id === e.pointerId && end()}
      onPointerCancel={(e) => origin?.id === e.pointerId && end()}
    >
      {origin && (
        <div className="touch__stick" style={{ left: origin.x, top: origin.y }}>
          <div className="touch__knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        </div>
      )}
      {!origin && <div className="touch__stick-hint">ruch</div>}
    </div>
  );
};

/** Drag-to-look handlers, shared by the look zone and the fire button. */
const useLookDrag = (pad: TouchPadSink) => {
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

const PadButtonView = ({
  pad,
  button,
  label,
  hint,
  className,
  lookToo = false,
}: {
  pad: TouchPadSink;
  button: TouchButton;
  label: string;
  hint: string;
  className: string;
  lookToo?: boolean;
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
      onContextMenu={(e) => e.preventDefault()}
      // Swallow the compatibility click: when the press opens a dialogue, the pad hides and the
      // click would land on whatever appeared under the thumb (the first dialogue choice).
      onTouchEnd={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
};

/**
 * On-screen gamepad for phones and tablets: floating move stick on the left, drag-to-look on
 * the right, action buttons in thumb reach. The fire button also steers the view while held.
 */
export const TouchControls = ({ pad }: { pad: TouchPadSink }) => {
  const intents = useIntents();
  const hasAbility = useUi((s) => s.ability !== null);
  const prompt = useUi((s) => s.prompt);
  const toggleSheet = useUi((s) => s.toggleSheet);
  const look = useLookDrag(pad);

  // Lift every finger when the controls go away (dialogue, shop, pause).
  useEffect(() => () => pad.reset(), [pad]);

  return (
    <div className="touch" data-testid="touch-controls">
      <div
        className="touch__look-zone"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          look.start(e);
        }}
        onPointerMove={look.move}
        onPointerUp={look.end}
        onPointerCancel={look.end}
      />
      <Stick pad={pad} />
      <div className="touch__top">
        <button type="button" className="touch__btn touch__btn--small" aria-label="Karta postaci" onClick={toggleSheet}>
          ☰
        </button>
        <button type="button" className="touch__btn touch__btn--small" aria-label="Pauza" onClick={() => intents.pause()}>
          II
        </button>
      </div>
      <div className="touch__actions">
        <PadButtonView pad={pad} button="fire" label="●" hint="Strzał" className="touch__btn--fire" lookToo />
        <PadButtonView pad={pad} button="interact" label="E" hint="Interakcja" className={`touch__btn--e${prompt ? " touch__btn--hot" : ""}`} />
        {hasAbility && <PadButtonView pad={pad} button="ability" label="Q" hint="Zdolność" className="touch__btn--q" />}
        <PadButtonView pad={pad} button="useItem" label="+" hint="Apteczka" className="touch__btn--h" />
        <PadButtonView pad={pad} button="toggleCamera" label="V" hint="Kamera FPP/TPP" className="touch__btn--v" />
      </div>
    </div>
  );
};
