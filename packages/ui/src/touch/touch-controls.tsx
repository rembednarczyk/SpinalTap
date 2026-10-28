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
  testId,
}: {
  pad: TouchPadSink;
  button: TouchButton;
  label: string;
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
 * Crouch on a touch screen is a toggle: one tap holds the button down for the pad, the next
 * lets it go. Lit while the player is crouched.
 */
const CrouchToggle = ({ pad }: { pad: TouchPadSink }) => {
  const crouched = useUi((s) => s.crouched);
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      aria-label="Kucnij lub wstań"
      aria-pressed={on}
      data-testid="touch-crouch"
      className={`touch__btn touch__btn--c${on || crouched ? " touch__btn--on" : ""}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        if (on) pad.release("crouch");
        else pad.press("crouch");
        setOn(!on);
      }}
      onContextMenu={(e) => e.preventDefault()}
      onTouchEnd={(e) => e.preventDefault()}
    >
      C
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
  const toggleCharacter = useUi((s) => s.toggleCharacter);
  // Lit while aiming down sights or guarding, which in toggle mode outlasts the press.
  const aimOn = useUi((s) => s.aiming || s.blocking);
  const scanning = useUi((s) => s.scanning);
  const unread = useUi((s) => s.phone.unread);
  const look = useLookDrag(pad);

  // Lift every finger when the controls go away (dialogue, shop, pause); the scanner too.
  useEffect(
    () => () => {
      pad.reset();
      intents.setScan(false);
    },
    [pad, intents],
  );

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
        {/* One button for the whole character screen instead of separate sheet and journal ones (plan §7). */}
        <button type="button" className="touch__btn touch__btn--small touch__btn--menu" aria-label="Postać" data-testid="touch-character" onClick={() => toggleCharacter("inventory")}>
          ☰
        </button>
        <button type="button" className="touch__btn touch__btn--small touch__btn--phone" aria-label="Telefon" data-testid="touch-phone" onClick={() => intents.openPhone()}>
          ☏{unread > 0 && <span className="touch__badge">{unread}</span>}
        </button>
        <button type="button" className="touch__btn touch__btn--small" aria-label="Pauza" onClick={() => intents.pause()}>
          II
        </button>
      </div>
      <div className="touch__actions">
        <PadButtonView pad={pad} button="fire" label="●" hint="Strzał" className="touch__btn--fire" lookToo />
        <PadButtonView pad={pad} button="aim" label="◎" hint="Celuj lub blokuj" className={`touch__btn--aim${aimOn ? " touch__btn--on" : ""}`} lookToo testId="touch-aim" />
        <PadButtonView pad={pad} button="interact" label="E" hint="Interakcja" className={`touch__btn--e${prompt ? " touch__btn--hot" : ""}`} />
        {hasAbility && <PadButtonView pad={pad} button="ability" label="Q" hint="Zdolność" className="touch__btn--q" />}
        <PadButtonView pad={pad} button="useItem" label="+" hint="Apteczka" className="touch__btn--h" />
        <PadButtonView pad={pad} button="toggleCamera" label="V" hint="Kamera FPP/TPP" className="touch__btn--v" />
        <PadButtonView pad={pad} button="toggleWeapon" label="X" hint="Schowaj lub wyciągnij broń" className="touch__btn--x" />
        <PadButtonView pad={pad} button="reload" label="R" hint="Przeładuj" className="touch__btn--r" />
        <PadButtonView pad={pad} button="jump" label="⤒" hint="Skok" className="touch__btn--jump" testId="touch-jump" />
        <CrouchToggle pad={pad} />
        {/* A toggle on touch; a tap on a hack in the scanner list uploads it. The app merges both into the input frame (TODO engine: the virtual pad could carry them). */}
        <button
          type="button"
          aria-label="Skaner"
          aria-pressed={scanning}
          data-testid="touch-scan"
          className={`touch__btn touch__btn--scan${scanning ? " touch__btn--on" : ""}`}
          onPointerDown={() => intents.setScan(!scanning)}
          onContextMenu={(e) => e.preventDefault()}
          onTouchEnd={(e) => e.preventDefault()}
        >
          ◈
        </button>
      </div>
    </div>
  );
};
