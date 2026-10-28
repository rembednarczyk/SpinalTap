import type { WeaponStripVm } from "../store/ui-store";
import { useHackIntents, useUi } from "../use-ui";
import { PadButtonView, swallowGhostClick, touchGuards } from "./pad-button";
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
 * Secondary actions in an arc around the fire button (ADR-0035): reload, the scanner, the dash
 * and "more", which unfolds the rest. Each target is at least 44 CSS px. The dash is a button of
 * the virtual pad (ADR-0036); the scanner goes through the hack intents.
 */
export const ActionArc = ({ pad, more, onMore }: { pad: TouchPadSink; more: boolean; onMore: () => void }) => {
  const hack = useHackIntents();
  const scanning = useUi((s) => s.scanning);
  const dashReady = useUi((s) => (s.dash ? s.dash.cooldown <= 0 : true));
  return (
    <div className="touch__arc" data-testid="touch-arc">
      <PadButtonView pad={pad} button="reload" label="R" hint="Przeładuj" className="touch__btn--arc touch__btn--arc-1" testId="touch-reload" />
      {/* A toggle on touch; a tap on a hack in the scanner list uploads it. */}
      <button
        type="button"
        aria-label="Skaner"
        aria-pressed={scanning}
        data-testid="touch-scan"
        className={`touch__btn touch__btn--arc touch__btn--arc-2 touch__btn--scan${scanning ? " touch__btn--on" : ""}`}
        onPointerDown={(e) => {
          swallowGhostClick(e);
          hack.setScan(!scanning);
        }}
        {...touchGuards}
      >
        ◈
      </button>
      <PadButtonView pad={pad} button="dash" label="»" hint="Zryw" className={`touch__btn--arc touch__btn--arc-3${dashReady ? "" : " touch__btn--cooling"}`} testId="touch-dash" />
      <button
        type="button"
        aria-label={more ? "Mniej akcji" : "Więcej akcji"}
        aria-expanded={more}
        data-testid="touch-more"
        className={`touch__btn touch__btn--arc touch__btn--arc-4${more ? " touch__btn--on" : ""}`}
        onPointerDown={(e) => {
          swallowGhostClick(e);
          onMore();
        }}
        {...touchGuards}
      >
        ⋯
      </button>
    </div>
  );
};

/** Crouch is a toggle on touch: one tap holds the pad button down, the next lets it go. */
const CrouchToggle = ({ pad, on, setOn }: { pad: TouchPadSink; on: boolean; setOn: (on: boolean) => void }) => {
  const crouched = useUi((s) => s.crouched);
  return (
    <button
      type="button"
      aria-label="Kucnij lub wstań"
      aria-pressed={on}
      data-testid="touch-crouch"
      className={`touch__btn touch__btn--more${on || crouched ? " touch__btn--on" : ""}`}
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

/**
 * What the "more" button unfolds (ADR-0035): the medkit with its count, the next weapon, crouch,
 * the camera and the holster, in one row left of the cluster. Crouch state lives with the
 * controls, so folding the row does not lose it.
 */
export const MoreActions = ({ pad, crouchOn, setCrouchOn }: { pad: TouchPadSink; crouchOn: boolean; setCrouchOn: (on: boolean) => void }) => {
  const weapons = useUi((s) => s.weapons);
  const medkits = useUi((s) => s.medkits);
  const next = nextWeaponKey(weapons);
  return (
    <div className="touch__more" data-testid="touch-more-actions">
      <PadButtonView
        pad={pad}
        button="useItem"
        label={
          <>
            +<span className="touch__badge">{medkits}</span>
          </>
        }
        hint={`Apteczka (${medkits})`}
        className="touch__btn--more touch__btn--h"
      />
      <button
        type="button"
        aria-label="Następna broń"
        data-testid="touch-weapon"
        disabled={next === null}
        className="touch__btn touch__btn--more"
        onPointerDown={() => next !== null && pad.selectWeaponSlot(next)}
        {...touchGuards}
      >
        ⇄
      </button>
      <CrouchToggle pad={pad} on={crouchOn} setOn={setCrouchOn} />
      <PadButtonView pad={pad} button="toggleCamera" label="V" hint="Kamera FPP/TPP" className="touch__btn--more" />
      <PadButtonView pad={pad} button="toggleWeapon" label="X" hint="Schowaj lub wyciągnij broń" className="touch__btn--more" />
    </div>
  );
};

/**
 * The contextual "Use" button (ADR-0035): there only while something can be used, and it
 * names what (the prompt) instead of showing a key.
 */
export const UseButton = ({ pad }: { pad: TouchPadSink }) => {
  const prompt = useUi((s) => s.prompt);
  if (!prompt) return null;
  return (
    <PadButtonView
      pad={pad}
      button="interact"
      label={
        <>
          <span className="touch__use-verb">Użyj</span>
          <span className="touch__use-what">{prompt}</span>
        </>
      }
      hint={`Interakcja: ${prompt}`}
      className="touch__btn--use touch__btn--hot"
      testId="touch-use"
    />
  );
};
