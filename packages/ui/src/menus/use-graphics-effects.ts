import { GRAPHICS_EFFECTS, type GraphicsEffectId, type GraphicsEffectVm, RENDER_RESOLUTION_SETTING_RANGE } from "../store/ui-store";
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

/** The render resolution slider (graphics options 14.11): a share of the full resolution, in steps of 5%. */
export interface RenderResolutionControl {
  readonly share: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  set(share: number): void;
}

export const useRenderResolution = (): RenderResolutionControl => {
  const share = useUi((s) => s.settings.renderResolution);
  const intents = useGraphicsIntents();
  const [min, max] = RENDER_RESOLUTION_SETTING_RANGE;
  return { share, min, max, step: 0.05, set: (s) => intents.setRenderResolution(s) };
};
