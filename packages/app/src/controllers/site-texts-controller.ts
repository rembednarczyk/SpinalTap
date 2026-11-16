import type { SettingsVm, UiStore } from "@seki/ui";
import { siteBoardTexts } from "../presenters/site-texts";

/**
 * What the controller needs of the renderer: the engine's `BabylonRenderer` holds the sites'
 * texts (`siteTexts`), a renderer without (tests, a headless run) is left alone. Not on
 * `RenderPort`: only the building sites' boards use it.
 */
export interface SiteTextsTarget {
  readonly siteTexts?: { set(texts: Readonly<Record<string, string>>): void };
}

/**
 * The building sites' boards in the player's language (ADR-0087 stage 2, ADR-0056): the texts
 * go to the renderer once at the start and again on every change of the language, so a board
 * reads as the options say from the first frame.
 */
export class SiteTextsController {
  private sent: SettingsVm["locale"] | null = null;
  private readonly target: SiteTextsTarget;

  constructor(
    private readonly ui: UiStore,
    /** The session's renderer, any `RenderPort`: the texts reach it when it holds them. */
    target: object,
  ) {
    this.target = target as SiteTextsTarget;
    this.sync();
    ui.subscribe(() => this.sync());
  }

  private sync(): void {
    const locale = this.ui.getState().settings.locale;
    if (locale === this.sent) return;
    this.sent = locale;
    this.target.siteTexts?.set(siteBoardTexts(locale));
  }
}
