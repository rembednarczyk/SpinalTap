import type { MessageKey } from "../i18n/en";
import { useT } from "../i18n/use-t";
import type { GraphicsEffectId } from "../store/ui-store";
import { Toggle } from "./settings-choice";
import { useGraphicsEffects } from "./use-graphics-effects";

const LABEL: Readonly<Record<GraphicsEffectId, MessageKey>> = {
  contactShade: "settings.contactShade",
  bloom: "settings.bloom",
};

/**
 * The High effects the player can switch off to see what weighs on the frame (graphics toggles
 * 14.11), under the quality choice. They apply at once; on a quality without them they stay off
 * and inactive, with a note why.
 */
export const GraphicsEffectSwitches = () => {
  const switches = useGraphicsEffects();
  const t = useT();
  const missing = switches.some((s) => !s.available);
  return (
    <>
      {switches.map((s) => (
        <Toggle key={s.id} label={LABEL[s.id]} on={s.on} disabled={!s.available} onChange={s.set} />
      ))}
      <p className="settings__hint" data-testid="graphics-effects-note">
        {t(missing ? "settings.graphicsEffects.highOnly" : "settings.graphicsEffects.live")}
      </p>
    </>
  );
};
