import type { WeaponStripVm } from "../store/ui-store";
import { useHackIntents, useTouchIntents, useUi } from "../use-ui";
import { PadButtonView, touchGuards } from "./pad-button";
import type { TouchPadSink } from "./touch-pad-sink";

/** The slot after the active one that holds a weapon, or null when there is no other (ADR-0035). */
export const nextWeaponKey = (weapons: WeaponStripVm | null): 1 | 2 | 3 | null => {
  if (!weapons) return null;
  const i = weapons.slots.findIndex((s) => s.slot === weapons.active);
  for (let n = 1; n < weapons.slots.length; n++) {
    const s = weapons.slots[(i + n) % weapons.slots.length];
    if (s?.name) return s.key;
  }
  return null;
};

/**
 * Secondary actions in an arc around the fire button (ADR-0035): reload, the next weapon, the
 * scanner and the dash. Each target is at least 44 CSS px. The scanner and the dash go through
 * intents, since the virtual pad does not carry them yet; the app merges them into the input frame.
 */
export const ActionArc = ({ pad }: { pad: TouchPadSink }) => {
  const hack = useHackIntents();
  const touch = useTouchIntents();
  const scanning = useUi((s) => s.scanning);
  const weapons = useUi((s) => s.weapons);
  const dashReady = useUi((s) => (s.dash ? s.dash.cooldown <= 0 : true));
  const next = nextWeaponKey(weapons);
  return (
    <div className="touch__arc" data-testid="touch-arc">
      <PadButtonView pad={pad} button="reload" label="R" hint="Przeładuj" className="touch__btn--arc touch__btn--arc-1" testId="touch-reload" />
      <button
        type="button"
        aria-label="Następna broń"
        data-testid="touch-weapon"
        disabled={next === null}
        className="touch__btn touch__btn--arc touch__btn--arc-2"
        onPointerDown={() => next !== null && pad.selectWeaponSlot(next)}
        {...touchGuards}
      >
        ⇄
      </button>
      {/* A toggle on touch; a tap on a hack in the scanner list uploads it. */}
      <button
        type="button"
        aria-label="Skaner"
        aria-pressed={scanning}
        data-testid="touch-scan"
        className={`touch__btn touch__btn--arc touch__btn--arc-3 touch__btn--scan${scanning ? " touch__btn--on" : ""}`}
        onPointerDown={() => hack.setScan(!scanning)}
        {...touchGuards}
      >
        ◈
      </button>
      <button
        type="button"
        aria-label="Zryw"
        data-testid="touch-dash"
        className={`touch__btn touch__btn--arc touch__btn--arc-4${dashReady ? "" : " touch__btn--cooling"}`}
        onPointerDown={() => touch.touchDash()}
        {...touchGuards}
      >
        »
      </button>
    </div>
  );
};

/**
 * The contextual "Use" button (ADR-0035): it names what the interaction does (the prompt)
 * instead of showing a key, and lights up while there is something to use.
 */
export const UseButton = ({ pad }: { pad: TouchPadSink }) => {
  const prompt = useUi((s) => s.prompt);
  return (
    <PadButtonView
      pad={pad}
      button="interact"
      label={
        <>
          <span className="touch__use-verb">Użyj</span>
          {prompt && <span className="touch__use-what">{prompt}</span>}
        </>
      }
      hint={prompt ? `Interakcja: ${prompt}` : "Interakcja"}
      className={`touch__btn--e touch__btn--use${prompt ? " touch__btn--hot" : ""}`}
      testId="touch-use"
    />
  );
};
