import { useEffect, useState } from "react";
import { useT } from "../i18n/use-t";
import { useHackIntents, usePhoneIntents, useSessionIntents, useUi } from "../use-ui";
import { useUnspentPoints } from "../hud/xp-hud";
import { ActionArc, FireButton, MoreActions, UseButton } from "./action-arc";
import { PadButtonView, useLookDrag } from "./pad-button";
import { DriveControls } from "./drive-controls";
import { useUiScale } from "../scale/use-ui-scale";
import type { TouchPadSink } from "./touch-pad-sink";

/** How far the knob travels, in the pad's px (on screen, times the pad's scale). */
const STICK_RADIUS = 56;

interface Drag {
  id: number;
  x: number;
  y: number;
}

/**
 * Floating stick: appears where the left thumb lands. The pad is a scaled layer (ADR-0085): the
 * finger's screen px become the layer's px, and the knob's reach grows with the ring.
 */
const Stick = ({ pad }: { pad: TouchPadSink }) => {
  const t = useT();
  const { touch: scale, touchLook } = useUiScale(true);
  // The ring is drawn `touchLook` large within the pad (ADR-0085); the knob reaches its edge.
  const drawn = scale * touchLook;
  const reach = STICK_RADIUS * drawn;
  const [origin, setOrigin] = useState<Drag | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  // The scanner's card takes the left column of a phone held sideways (G-433); the stick still works.
  const scanning = useUi((s) => s.scanning);
  // So does the contract card, down to the weapon strip (G-846); the ring is only a hint.
  const briefing = useUi((s) => s.debrief !== null);

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
        if (len > reach) {
          dx = (dx / len) * reach;
          dy = (dy / len) * reach;
        }
        setKnob({ x: dx / drawn, y: dy / drawn });
        pad.setStick(dx / reach, -dy / reach);
      }}
      onPointerUp={(e) => origin?.id === e.pointerId && end()}
      onPointerCancel={(e) => origin?.id === e.pointerId && end()}
    >
      {origin && (
        <div className="touch__stick" style={{ left: origin.x / scale, top: origin.y / scale }}>
          <div className="touch__knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        </div>
      )}
      {!origin && !scanning && !briefing && <div className="touch__stick-hint">{t("touch.move")}</div>}
    </div>
  );
};

/**
 * A group of the pad drawn toward its corner of the screen (ADR-0085): under scale 1 the group, its
 * buttons and the gaps between them pull toward the corner by `touchSpread`. At 1 and above, as before.
 */
const toCorner = (spread: number, origin: string) => (spread < 1 ? { transform: `scale(${spread})`, transformOrigin: origin } : undefined);

/** Menu, phone and pause in one row along the top edge, clear of the minimap and the wallet. */
const TopBar = ({ spread }: { spread: number }) => {
  const t = useT();
  const phone = usePhoneIntents();
  const session = useSessionIntents();
  const toggleCharacter = useUi((s) => s.toggleCharacter);
  const unread = useUi((s) => s.phone.unread);
  // Points left to spend (ADR-0059, stage 7) wear a badge, like the phone's unread messages, and
  // open the screen on the Progress tab (decision of 6.11); without points it opens on the inventory.
  const points = useUnspentPoints();
  return (
    <div className="touch__top" style={toCorner(spread, "100% 0%")}>
      {/* One button for the whole character screen instead of separate sheet and journal ones (plan §7). */}
      <button type="button" className="touch__btn touch__btn--small touch__btn--menu" aria-label={t("touch.character")} data-testid="touch-character" onClick={() => toggleCharacter(points > 0 ? "progress" : "inventory")}>
        ☰
        {points > 0 && (
          <span className="touch__badge" data-testid="touch-character-points" title={t("progress.unspent", { count: points })}>
            {points}
          </span>
        )}
      </button>
      <button type="button" className="touch__btn touch__btn--small touch__btn--phone" aria-label={t("touch.phone")} data-testid="touch-phone" onClick={() => phone.openPhone()}>
        ☏{unread > 0 && <span className="touch__badge">{unread}</span>}
      </button>
      <button type="button" className="touch__btn touch__btn--small" aria-label={t("touch.pause")} onClick={() => session.pause()}>
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
  const look = useLookDrag(pad);
  const { touchSpread } = useUiScale(true);
  const [more, setMore] = useState(false);
  const [crouchOn, setCrouchOn] = useState(false);
  // At the wheel (ADR-0097 §4) the pedals, the steering slider, the handbrake and the horn.
  const driving = useUi((s) => s.vehicle !== null);

  // Lift every finger when the controls go away (dialogue, shop, pause); the scanner too.
  useEffect(
    () => () => {
      pad.reset();
      hack.setScan(false);
    },
    [pad, hack],
  );
  // Getting in or out swaps the pad under the thumbs: what they held on one goes with it.
  useEffect(() => pad.reset(), [pad, driving]);

  return (
    <div className="touch ui-layer ui-layer--touch" data-testid="touch-controls">
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
      <TopBar spread={touchSpread} />
      {driving ? (
        <DriveControls pad={pad} style={toCorner(touchSpread, "100% 100%")} />
      ) : (
        <OnFoot pad={pad} more={more} setMore={setMore} crouchOn={crouchOn} setCrouchOn={setCrouchOn} spread={touchSpread} />
      )}
    </div>
  );
};

/** The pad on foot: the floating stick, fire, aim, jump, the arc and "Use". */
const OnFoot = ({
  pad,
  more,
  setMore,
  crouchOn,
  setCrouchOn,
  spread,
}: {
  pad: TouchPadSink;
  more: boolean;
  setMore: (on: boolean) => void;
  crouchOn: boolean;
  setCrouchOn: (on: boolean) => void;
  spread: number;
}) => {
  const t = useT();
  const hasAbility = useUi((s) => s.ability !== null);
  // Lit while aiming down sights or guarding, which in toggle mode outlasts the press.
  const aimOn = useUi((s) => s.aiming || s.blocking);
  return (
    <>
      <Stick pad={pad} />
      <div className="touch__actions" style={toCorner(spread, "100% 100%")}>
        <FireButton pad={pad} />
        <ActionArc pad={pad} more={more} onMore={() => setMore(!more)} />
        <PadButtonView pad={pad} button="aim" label="◎" hint={t("touch.aim")} className={`touch__btn--aim${aimOn ? " touch__btn--on" : ""}`} lookToo testId="touch-aim" />
        <PadButtonView pad={pad} button="jump" label="⤒" hint={t("touch.jump")} className="touch__btn--jump" testId="touch-jump" />
        {hasAbility && <PadButtonView pad={pad} button="ability" label="⚡" hint={t("touch.ability")} className="touch__btn--q" />}
        <UseButton pad={pad} />
        {more && <MoreActions pad={pad} crouchOn={crouchOn} setCrouchOn={setCrouchOn} />}
      </div>
    </>
  );
};
