import { type SettingsIntents, type SettingsVm, type UiStore, patchUi } from "@seki/ui";
import { bindKey, controlsVm } from "../controls";
import { needsReload, sanitizeSettings } from "../settings";

export interface SettingsHost {
  /** Settings the page started with; graphics quality stays at these until a reload. */
  readonly applied: SettingsVm;
  save(next: SettingsVm): void;
  reload(): void;
}

/** Settings and key bindings: sanitised, saved through the host, and in the store at once. */
export class SettingsController implements SettingsIntents {
  private readonly appliedSettings: SettingsVm;

  constructor(
    private readonly ui: UiStore,
    /** Where settings live (localStorage in the browser). Without it changes last for the session only. */
    private readonly host?: SettingsHost,
  ) {
    this.appliedSettings = host?.applied ?? ui.getState().settings;
    patchUi(ui, { settings: this.appliedSettings, controls: controlsVm(this.appliedSettings.bindings), reloadNeeded: false });
  }

  changeSettings(patch: Partial<SettingsVm>): void {
    const current = this.ui.getState().settings;
    const next = sanitizeSettings({ ...current, ...patch }, current);
    patchUi(this.ui, { settings: next, controls: controlsVm(next.bindings), reloadNeeded: needsReload(this.appliedSettings, next) });
    this.host?.save(next);
  }

  bindKey(action: string, code: string): void {
    this.changeSettings({ bindings: bindKey(this.ui.getState().settings.bindings, action, code) });
  }

  resetControls(): void {
    this.changeSettings({ bindings: {} });
  }

  reload(): void {
    this.host?.reload();
  }
}
