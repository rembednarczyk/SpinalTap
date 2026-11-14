import { GRAPHICS_EFFECTS, type GraphicsEffectId, type GraphicsEffectVm } from "../store/ui-store";
import { useGraphicsIntents, useUi } from "../use-ui";

/** One switch as the options draw it. */
export interface GraphicsEffectSwitch extends GraphicsEffectVm {
  readonly id: GraphicsEffectId;
  set(on: boolean): void;
}

/** The graphics switches (graphics toggles 14.11): their state from the store, changes through the graphics intent. */
export const useGraphicsEffects = (): readonly GraphicsEffectSwitch[] => {
  const effects = useUi((s) => s.graphicsEffects);
  const intents = useGraphicsIntents();
  return GRAPHICS_EFFECTS.map((id) => ({ id, ...effects[id], set: (on: boolean) => intents.setGraphicsEffect(id, on) }));
};
