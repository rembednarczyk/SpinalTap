import type { CSSProperties } from "react";
import { useT } from "../i18n/use-t";
import { TONE_STYLE, type WheelSlot, arcLayout } from "./wheel-layout";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

interface Props {
  readonly slots: readonly WheelSlot[];
  readonly hot: number;
  readonly onPoint: (slot: number) => void;
  readonly onPick: (slot: number) => void;
}

/**
 * The options on an arc right of the person Seki talks to (ADR-0039). Each slot shows its icon,
 * its text and its key; the highlighted one grows and a ray joins it to the hub. Mouse and touch
 * point by hovering and pick by clicking (a click, so `swallowNextClick` still eats the ghost
 * click a lifted finger leaves behind).
 */
export const DialogueWheel = ({ slots, hot, onPoint, onPick }: Props) => {
  const t = useT();
  const points = arcLayout(slots.length);
  const ray = points[hot];
  return (
    <div className="wheel" role="group" aria-label={t("dialogue.reply")} style={{ "--n": slots.length, "--ray": `var(--tone-${slots[hot]?.tone ?? "main"})` } as Vars}>
      <div className="wheel__hub" aria-hidden="true" />
      {ray && <div className="wheel__ray" aria-hidden="true" style={{ "--angle": `${ray.angle}deg`, "--len": Math.hypot(ray.x, ray.y) } as Vars} />}
      {slots.map((slot, i) => {
        const p = points[i] ?? { x: 0, y: 0 };
        const tone = TONE_STYLE[slot.tone];
        return (
          <button
            key={slot.key}
            type="button"
            className={i === hot ? `wheel__opt wheel__opt--${slot.tone} wheel__opt--hot` : `wheel__opt wheel__opt--${slot.tone}`}
            data-tone={slot.tone}
            aria-current={i === hot ? "true" : undefined}
            style={{ "--x": p.x.toFixed(3), "--y": p.y.toFixed(3), "--i": i } as Vars}
            onPointerEnter={() => onPoint(i)}
            onFocus={() => onPoint(i)}
            onClick={() => onPick(i)}
          >
            <span className="wheel__icon" aria-hidden="true">
              {tone.icon}
            </span>
            <span className="wheel__text">{slot.text}</span>
            <span className="dlg-sr">, {t(tone.label)}</span>
            <kbd className="wheel__key" aria-hidden="true">
              {slot.hint}
            </kbd>
          </button>
        );
      })}
    </div>
  );
};
