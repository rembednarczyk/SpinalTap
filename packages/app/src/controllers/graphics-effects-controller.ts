import type { GraphicsEffects } from "@seki/engine";
import { type GraphicsEffectId, type GraphicsIntents, type SettingsIntents, type SettingsVm, type UiStore, patchUi } from "@seki/ui";
import { graphicsEffectsOfSettings, graphicsEffectsVm } from "../presenters/graphics-effects";
import { clampRenderResolution } from "../settings";

/**
 * What the controller needs of the renderer: the engine's `BabylonRenderer` has it, a renderer
 * without (tests, a headless run) is left alone. Not on `RenderPort`: only the app's options use it.
 */
export interface GraphicsEffectsTarget {
  setGraphicsOptions?(options: { readonly effects?: GraphicsEffects; readonly resolution?: number }): void;
}

/**
 * The graphics options that apply at once (graphics options 14.11): the render resolution and
 * the High effects' switches. The choice goes into the settings (saved with them), the switches
 * into the store and both to the renderer, on every change of the settings and once at the
 * start, so a saved value holds from the first frame.
 */
export class GraphicsEffectsController implements GraphicsIntents {
  private shown: SettingsVm | null = null;
  private sent: GraphicsEffects | null = null;
  private sentResolution: number | null = null;
  private readonly target: GraphicsEffectsTarget;

  constructor(
    private readonly ui: UiStore,
    private readonly settings: Pick<SettingsIntents, "changeSettings">,
    /** The session's renderer, any `RenderPort`: the options reach it when it has the methods. */
    target: object,
  ) {
    this.target = target as GraphicsEffectsTarget;
    this.sync();
    ui.subscribe(() => this.sync());
  }

  setGraphicsEffect(effect: GraphicsEffectId, on: boolean): void {
    this.settings.changeSettings({ [effect]: on });
  }

  setRenderResolution(share: number): void {
    this.settings.changeSettings({ renderResolution: clampRenderResolution(share, this.ui.getState().settings.renderResolution) });
  }

  private sync(): void {
    const s = this.ui.getState().settings;
    if (s === this.shown) return;
    this.shown = s;
    if (s.renderResolution !== this.sentResolution) {
      this.sentResolution = s.renderResolution;
      this.target.setGraphicsOptions?.({ resolution: s.renderResolution });
    }
    const effects = graphicsEffectsOfSettings(s);
    if (!this.sent || this.sent.contactShade !== effects.contactShade || this.sent.bloom !== effects.bloom) {
      this.sent = effects;
      this.target.setGraphicsOptions?.({ effects });
    }
    patchUi(this.ui, { graphicsEffects: graphicsEffectsVm(s) });
  }
}
