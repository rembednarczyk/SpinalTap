import { PREPARE_STAGES, type PrepareStage, type RenderPort, type Vec3 } from "@seki/core";
import { NO_LOADING, type Screen, type UiStore, patchUi } from "@seki/ui";

export interface LoadingControllerDeps {
  readonly render: RenderPort;
  readonly ui: UiStore;
  readonly setScreen: (screen: Screen) => void;
}

/**
 * The loading screen of ADR-0057: a new game or a load starts behind it while the renderer
 * prepares the start (`RenderPort.prepare`), and plays once every stage is over. The
 * simulation stands meanwhile, since it only steps on the playing screen. The bar never goes
 * back, and a renderer that prepares nothing starts the game at once.
 */
export class LoadingController {
  /** Each start gets a number; a newer start (a quickload while loading) or `cancel` voids the older. */
  private run = 0;
  private active = false;

  constructor(private readonly deps: LoadingControllerDeps) {}

  /** A start is behind the loading screen now. */
  get loading(): boolean {
    return this.active;
  }

  /**
   * Starts the game with the player at `at`; `play` runs once it is on the playing screen (the
   * start's toasts). A rejected prepare starts it too: a missing file only means the procedural look.
   */
  start(at: Vec3, play: () => void): void {
    const run = ++this.run;
    const { render, ui } = this.deps;
    if (!render.prepare) {
      this.finish(play);
      return;
    }
    this.active = true;
    let progress = 0;
    let stage = 0;
    patchUi(ui, { loading: { progress: 0, stage: PREPARE_STAGES[0] } });
    this.deps.setScreen("loading");
    const onProgress = (done: number, label: PrepareStage): void => {
      if (run !== this.run) return;
      progress = Math.max(progress, Math.min(1, Number.isFinite(done) ? done : 0));
      stage = Math.max(stage, PREPARE_STAGES.indexOf(label));
      patchUi(ui, { loading: { progress, stage: PREPARE_STAGES[stage] ?? null } });
    };
    const done = (): void => {
      if (run === this.run) this.finish(play);
    };
    render.prepare(at, onProgress).then(done, done);
  }

  /** The start under way leads nowhere any more (back to the title). */
  cancel(): void {
    if (this.active) this.deps.render.cancelPrepare?.();
    this.run++;
    this.active = false;
    patchUi(this.deps.ui, { loading: NO_LOADING });
  }

  private finish(play: () => void): void {
    this.active = false;
    patchUi(this.deps.ui, { loading: NO_LOADING });
    this.deps.setScreen("playing");
    play();
  }
}
