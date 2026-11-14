import type { GraphicsEffects } from "@seki/engine";
import { type GraphicsEffectId, type GraphicsIntents, type SettingsIntents, type SettingsVm, type UiStore, patchUi } from "@seki/ui";
import { graphicsEffectsOfSettings, graphicsEffectsVm } from "../presenters/graphics-effects";

/**
 * What the controller needs of the renderer: the engine's `BabylonRenderer` has it, a renderer
 * without (tests, a headless run) is left alone. Not on `RenderPort`: only the app's options use it.
 */
export interface GraphicsEffectsTarget {
  setGraphicsEffects?(effects: GraphicsEffects): void;
}

/**
 * The graphics switches (graphics toggles 14.11): the choice goes into the settings (saved with
 * them), the switches into the store and the effects to the renderer at once, on every change
 * of the settings and once at the start, so a saved "off" holds from the first frame.
 */
export class GraphicsEffectsController implements GraphicsIntents {
  private shown: SettingsVm | null = null;
  private sent: GraphicsEffects | null = null;
  private readonly target: GraphicsEffectsTarget;

  constructor(
    private readonly ui: UiStore,
    private readonly settings: Pick<SettingsIntents, "changeSettings">,
    /** The session's renderer, any `RenderPort`: the switch reaches it when it has the method. */
    target: object,
  ) {
    this.target = target as GraphicsEffectsTarget;
    this.sync();
    ui.subscribe(() => this.sync());
  }

  setGraphicsEffect(effect: GraphicsEffectId, on: boolean): void {
    this.settings.changeSettings({ [effect]: on });
  }

  private sync(): void {
    const s = this.ui.getState().settings;
    if (s === this.shown) return;
    this.shown = s;
    const effects = graphicsEffectsOfSettings(s);
    if (!this.sent || this.sent.contactShade !== effects.contactShade || this.sent.bloom !== effects.bloom) {
      this.sent = effects;
      this.target.setGraphicsEffects?.(effects);
    }
    patchUi(this.ui, { graphicsEffects: graphicsEffectsVm(s) });
  }
}
