import type { MessageKey } from "../i18n/en";
import { useT } from "../i18n/use-t";
import type { SettingsVm } from "../store/ui-store";

/** A setting on a range, with its value as text beside it. */
export const Slider = ({
  id,
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  id: keyof SettingsVm;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) => (
  <label className="settings__row" htmlFor={`setting-${id}`}>
    <span className="settings__label">{label}</span>
    <input
      id={`setting-${id}`}
      className="settings__slider"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.currentTarget.value))}
    />
    <span className="settings__value">{format(value)}</span>
  </label>
);

export const percent = (v: number) => `${Math.round(v * 100)}%`;

/** A choice's values with the catalog keys of their names (ADR-0056). */
export type Options<T extends string> = readonly (readonly [T, MessageKey])[];

/** A row of radio buttons; `disabled` greys them out for a setting the current quality lacks. */
export const Choice = <T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: MessageKey;
  value: T;
  options: Options<T>;
  onChange: (v: T) => void;
  disabled?: boolean;
}) => {
  const t = useT();
  return (
    <div className={`settings__row${disabled ? " settings__row--off" : ""}`}>
      <span className="settings__label">{t(label)}</span>
      <div className="settings__choice" role="radiogroup" aria-label={t(label)} aria-disabled={disabled || undefined}>
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            disabled={disabled}
            className={`settings__option${value === v ? " settings__option--on" : ""}`}
            onClick={() => onChange(v)}
          >
            {t(text)}
          </button>
        ))}
      </div>
    </div>
  );
};

const ON_OFF: Options<"on" | "off"> = [
  ["off", "settings.off"],
  ["on", "settings.on"],
];

/** A yes-or-no setting as a choice of two. */
export const Toggle = ({ label, on, onChange, disabled }: { label: MessageKey; on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) => (
  <Choice label={label} value={on ? "on" : "off"} options={ON_OFF} onChange={(v) => onChange(v === "on")} disabled={disabled} />
);
