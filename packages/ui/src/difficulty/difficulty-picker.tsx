import { useState } from "react";
import { DIFFICULTY_FIELDS, DIFFICULTY_MAX, DIFFICULTY_MIN, DIFFICULTY_PRESETS, type DifficultyField, type DifficultyPresetId, type DifficultyProfile, presetOf } from "@seki/core";
import { formatNumber, useLocale } from "../i18n/number";
import { useT } from "../i18n/use-t";
import "./difficulty.css";

/** A choice of the picker: one of the presets, or the player's own sliders. */
export type DifficultyChoice = DifficultyPresetId | "custom";

const CHOICES: readonly DifficultyChoice[] = ["story", "normal", "hard", "custom"];

/** A slider's step: the multipliers move by five hundredths. */
const STEP = 0.05;

const Slider = ({ field, value, onChange }: { field: DifficultyField; value: number; onChange: (v: number) => void }) => {
  const t = useT();
  const locale = useLocale();
  const id = `difficulty-${field}`;
  const label = t(`difficulty.field.${field}`);
  return (
    <label className="settings__row difficulty__row" htmlFor={id}>
      <span className="settings__label">{label}</span>
      <input
        id={id}
        aria-label={label}
        className="settings__slider"
        type="range"
        min={DIFFICULTY_MIN}
        max={DIFFICULTY_MAX}
        step={STEP}
        value={value}
        onChange={(e) => onChange(Math.round(Number(e.currentTarget.value) * 100) / 100)}
      />
      <span className="settings__value">{`${formatNumber(locale, value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`}</span>
    </label>
  );
};

/**
 * The difficulty of ADR-0066 as one control, for the new game and the pause menu alike: three
 * presets and "Custom", the chosen one in a sentence, and the six sliders folded away until
 * "Custom" is on. A preset sets the sliders; moving a slider makes it "Custom". Controlled: it
 * shows `value` and hands every change to `onChange` as a whole profile.
 */
export const DifficultyPicker = ({ value, onChange }: { value: DifficultyProfile; onChange: (profile: DifficultyProfile) => void }) => {
  const t = useT();
  // "Custom" stays on once picked, even while the sliders still match a preset.
  const [custom, setCustom] = useState(() => presetOf(value) === "custom");
  const chosen: DifficultyChoice = custom ? "custom" : presetOf(value);
  const pick = (choice: DifficultyChoice) => {
    setCustom(choice === "custom");
    if (choice !== "custom") onChange(DIFFICULTY_PRESETS[choice]);
  };
  const slide = (field: DifficultyField, v: number) => {
    setCustom(true);
    onChange({ ...value, [field]: v });
  };
  return (
    <div className="difficulty" data-testid="difficulty-picker">
      <div className="settings__choice" role="radiogroup" aria-label={t("difficulty.heading")}>
        {CHOICES.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={chosen === c} className={`settings__option${chosen === c ? " settings__option--on" : ""}`} onClick={() => pick(c)}>
            {t(`difficulty.preset.${c}`)}
          </button>
        ))}
      </div>
      <p className="difficulty__desc" data-testid="difficulty-desc">
        {t(`difficulty.desc.${chosen}`)}
      </p>
      {chosen === "custom" && (
        <div className="difficulty__custom" role="group" aria-label={t("difficulty.custom")} data-testid="difficulty-custom">
          {DIFFICULTY_FIELDS.map((f) => (
            <Slider key={f} field={f} value={value[f]} onChange={(v) => slide(f, v)} />
          ))}
        </div>
      )}
    </div>
  );
};
