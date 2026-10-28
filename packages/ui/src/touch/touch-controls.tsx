import { useEffect, useState } from "react";
import { useHackIntents, usePhoneIntents, useSessionIntents, useUi } from "../use-ui";
import { ActionArc, MoreActions, UseButton } from "./action-arc";
import { PadButtonView, useLookDrag } from "./pad-button";
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

/** Menu, phone and pause in one row along the top edge, clear of the minimap and the wallet. */
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
 * On-screen gamepad for phones and tablets (ADR-0035): floating move stick on the left,
 * drag-to-look on the right. Always there: fire (it also steers the view), aim, jump and the
 * arc of reload, scanner, dash and "more"; "Use" only while there is something to use, the
 * ability only with its implant. The rest unfolds behind "more".
 */
export const TouchControls = ({ pad }: { pad: TouchPadSink }) => {
  const hack = useHackIntents();
  const hasAbility = useUi((s) => s.ability !== null);
  // Lit while aiming down sights or guarding, which in toggle mode outlasts the press.
  const aimOn = useUi((s) => s.aiming || s.blocking);
  const look = useLookDrag(pad);
  const [more, setMore] = useState(false);
  const [crouchOn, setCrouchOn] = useState(false);

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
        <ActionArc pad={pad} more={more} onMore={() => setMore(!more)} />
        <PadButtonView pad={pad} button="aim" label="◎" hint="Celuj lub blokuj" className={`touch__btn--aim${aimOn ? " touch__btn--on" : ""}`} lookToo testId="touch-aim" />
        <PadButtonView pad={pad} button="jump" label="⤒" hint="Skok" className="touch__btn--jump" testId="touch-jump" />
        {hasAbility && <PadButtonView pad={pad} button="ability" label="⚡" hint="Zdolność" className="touch__btn--q" />}
        <UseButton pad={pad} />
        {more && <MoreActions pad={pad} crouchOn={crouchOn} setCrouchOn={setCrouchOn} />}
      </div>
    </div>
  );
};
