import { useEffect, useState } from "react";
import { useHackIntents, usePhoneIntents, useSessionIntents, useUi } from "../use-ui";
import { ActionArc, UseButton } from "./action-arc";
import { PadButtonView, touchGuards, useLookDrag } from "./pad-button";
import type { TouchPadSink } from "./touch-pad-sink";

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
      {...touchGuards}
    >
      C
    </button>
  );
};

/** Menu, phone and pause along the top edge. */
const TopBar = () => {
  const phone = usePhoneIntents();
  const session = useSessionIntents();
  const toggleCharacter = useUi((s) => s.toggleCharacter);
  const unread = useUi((s) => s.phone.unread);
  return (
    <div className="touch__top">
      {/* One button for the whole character screen instead of separate sheet and journal ones (plan §7). */}
      <button type="button" className="touch__btn touch__btn--small touch__btn--menu" aria-label="Postać" data-testid="touch-character" onClick={() => toggleCharacter("inventory")}>
        ☰
      </button>
      <button type="button" className="touch__btn touch__btn--small touch__btn--phone" aria-label="Telefon" data-testid="touch-phone" onClick={() => phone.openPhone()}>
        ☏{unread > 0 && <span className="touch__badge">{unread}</span>}
      </button>
      <button type="button" className="touch__btn touch__btn--small" aria-label="Pauza" onClick={() => session.pause()}>
        II
      </button>
    </div>
  );
};

/**
 * On-screen gamepad for phones and tablets: floating move stick on the left, drag-to-look on
 * the right, action buttons in thumb reach. The fire button also steers the view while held;
 * secondary actions sit in an arc around it and "Use" names the interaction (ADR-0035).
 */
export const TouchControls = ({ pad }: { pad: TouchPadSink }) => {
  const hack = useHackIntents();
  const hasAbility = useUi((s) => s.ability !== null);
  // Lit while aiming down sights or guarding, which in toggle mode outlasts the press.
  const aimOn = useUi((s) => s.aiming || s.blocking);
  const look = useLookDrag(pad);

  // Lift every finger when the controls go away (dialogue, shop, pause); the scanner too.
  useEffect(
    () => () => {
      pad.reset();
      hack.setScan(false);
    },
    [pad, hack],
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
      <TopBar />
      <div className="touch__actions">
        <PadButtonView pad={pad} button="fire" label="●" hint="Strzał" className="touch__btn--fire" lookToo />
        <ActionArc pad={pad} />
        <PadButtonView pad={pad} button="aim" label="◎" hint="Celuj lub blokuj" className={`touch__btn--aim${aimOn ? " touch__btn--on" : ""}`} lookToo testId="touch-aim" />
        <UseButton pad={pad} />
        {hasAbility && <PadButtonView pad={pad} button="ability" label="Q" hint="Zdolność" className="touch__btn--q" />}
        <PadButtonView pad={pad} button="useItem" label="+" hint="Apteczka" className="touch__btn--h" />
        <PadButtonView pad={pad} button="toggleCamera" label="V" hint="Kamera FPP/TPP" className="touch__btn--v" />
        <PadButtonView pad={pad} button="toggleWeapon" label="X" hint="Schowaj lub wyciągnij broń" className="touch__btn--x" />
        <PadButtonView pad={pad} button="jump" label="⤒" hint="Skok" className="touch__btn--jump" testId="touch-jump" />
        <CrouchToggle pad={pad} />
      </div>
    </div>
  );
};
