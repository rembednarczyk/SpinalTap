import { type CSSProperties, useState } from "react";
import { useT } from "../i18n/use-t";
import { useUiScale } from "../scale/use-ui-scale";
import { FireButton, UseButton } from "./action-arc";
import { PadButtonView } from "./pad-button";
import type { TouchPadSink } from "./touch-pad-sink";

/** How far the knob slides either way for a full turn of the wheel, in the pad's px. */
export const STEER_REACH = 72;

interface Drag {
  id: number;
  x: number;
  y: number;
}

/**
 * The steering at the wheel on a phone (ADR-0097 §4): a slider that appears where the left thumb
 * lands, as the floating stick does; only its sideways travel counts. Let go, the wheel comes back
 * (the simulation eases it back at the keyboard's rate).
 */
const SteerSlider = ({ pad }: { pad: TouchPadSink }) => {
  const t = useT();
  const { touch: scale, touchLook } = useUiScale(true);
  const drawn = scale * touchLook;
  const reach = STEER_REACH * drawn;
  const [origin, setOrigin] = useState<Drag | null>(null);
  const [knob, setKnob] = useState(0);
  const end = () => {
    setOrigin(null);
    setKnob(0);
    pad.setSteer?.(0);
  };
  return (
    <div
      className="touch__stick-zone"
      data-testid="touch-steer"
      onPointerDown={(e) => {
        if (origin) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setOrigin({ id: e.pointerId, x: e.clientX, y: e.clientY });
      }}
      onPointerMove={(e) => {
        if (!origin || e.pointerId !== origin.id) return;
        const dx = Math.max(-reach, Math.min(reach, e.clientX - origin.x));
        setKnob(dx / drawn);
        pad.setSteer?.(dx / reach);
      }}
      onPointerUp={(e) => origin?.id === e.pointerId && end()}
      onPointerCancel={(e) => origin?.id === e.pointerId && end()}
    >
      {origin ? (
        <div className="touch__steer" style={{ left: origin.x / scale, top: origin.y / scale }}>
          <div className="touch__steer-knob" style={{ transform: `translateX(${knob}px)` }} />
        </div>
      ) : (
        <div className="touch__stick-hint touch__steer-hint">{t("touch.steer")}</div>
      )}
    </div>
  );
};

/**
 * The pad at the wheel (ADR-0097 §4): the steering slider on the left; on the right the gas and
 * brake pedals (held, the brake reverses from a standstill), the handbrake and the horn, both held,
 * the fire button for a shot out of the window and "Use" to get out. The look drag stays behind them.
 */
export const DriveControls = ({ pad, style }: { pad: TouchPadSink; style: CSSProperties | undefined }) => {
  const t = useT();
  return (
    <>
      <SteerSlider pad={pad} />
      <div className="touch__actions touch__actions--drive" style={style} data-testid="touch-drive">
        <PadButtonView pad={pad} button="gas" label="▲" hint={t("touch.gas")} className="touch__btn--gas" testId="touch-gas" />
        <PadButtonView pad={pad} button="brake" label="▼" hint={t("touch.brake")} className="touch__btn--brake" testId="touch-brake" />
        <PadButtonView pad={pad} button="handbrake" label="P" hint={t("touch.handbrake")} className="touch__btn--handbrake" testId="touch-handbrake" />
        <PadButtonView pad={pad} button="horn" label="♪" hint={t("touch.horn")} className="touch__btn--horn" testId="touch-horn" />
        <FireButton pad={pad} />
        <UseButton pad={pad} />
      </div>
    </>
  );
};
