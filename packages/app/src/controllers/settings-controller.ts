import { type CameraIntents, type SettingsIntents, type SettingsVm, type UiStore, patchUi } from "@seki/ui";
import { bindKey, controlsVm } from "../controls";
import { clampFieldOfView, needsReload, sanitizeSettings } from "../settings";

export interface SettingsHost {
  /** Settings the page started with; graphics quality stays at these until a reload. */
  readonly applied: SettingsVm;
  save(next: SettingsVm): void;
  reload(): void;
}

/** Settings and key bindings: sanitised, saved through the host, and in the store at once. */
export class SettingsController implements SettingsIntents, CameraIntents {
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

  /** The camera reads the setting every frame (main.tsx), so it applies at once (ADR-0049). */
  setFieldOfView(degrees: number): void {
    this.changeSettings({ horizontalFov: clampFieldOfView(degrees, this.ui.getState().settings.horizontalFov) });
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
