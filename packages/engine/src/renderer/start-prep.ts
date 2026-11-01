import { PREPARE_STAGES, type PrepareStage } from "@seki/core";
import { MeshBuilder, type Scene } from "../babylon";
import type { ToonMaterials } from "../npr/toon-material";
import type { Signage } from "./signage";
import type { Stage } from "./stage";

/** What preparing the start needs from the renderer and the scene (fakes in tests). */
export interface StartPrepDeps {
  /** Waits for the model manifest, then starts loading every character and weapon file: one promise each. */
  readonly modelFiles: () => Promise<readonly Promise<unknown>[]>;
  /** The city kit and the facade props have loaded or failed; resolved at once without a kit. */
  readonly cityKit: () => Promise<unknown>;
  /** Near cells of the map city still waiting for their detailed buildings (0: settled). */
  readonly cityWaiting: () => number;
  /** Every material of the scene compiled (`scene.whenReadyAsync`). */
  readonly sceneReady: () => Promise<unknown>;
  /** The scene is still ready after the last drawn frame (`scene.isReady(true)`). */
  readonly isReady: () => boolean;
  /** The GPU has caught up enough for another frame (`GpuPacer.canDraw`, G-029). */
  readonly canDraw: () => boolean;
  /** Draws one frame under the loading screen and marks it for the pacer. */
  readonly draw: () => void;
}

/** Share of the bar per stage (ADR-0057), in the order of `PREPARE_STAGES`. */
export const STAGE_WEIGHT: Readonly<Record<PrepareStage, number>> = { models: 0.3, cityKit: 0.2, city: 0.3, shaders: 0.2 };

/** Frames in a row the city stays settled before it counts as built (a frame can stream in more). */
const SETTLED_FRAMES = 2;
/** Warm-up frames drawn once the shaders compiled: shadows and the wet probe ask for more on their first. */
const WARM_FRAMES = 3;
/** A stage that waits on frames gives up after this many, so a stuck one never holds the start. */
const MAX_STAGE_FRAMES = 900;
/**
 * A stage waiting on downloads (models, the city kit) gives up after this many frames, as if they
 * had failed: a request that never answers must not hold the start (ADR-0057). Counted in frames,
 * not wall time, like the other stages; the files keep loading and show up once they arrive.
 */
export const MAX_FILE_FRAMES = 1800;

const ignore = (): void => {};

/**
 * Prepares the start of a game for `RenderPort.prepare` (ADR-0057): models and weapons, the city
 * kit, the city round the camera and the shaders, in that order. Stages that wait for frames are
 * driven by `tick()`, which the renderer calls at the end of its frame; nothing is drawn but the
 * warm-up frames, each one only when the GPU pacer allows it. A newer `run` ends the older one.
 */
export class StartPrep {
  private generation = 0;
  private running = false;
  /** The stage waiting on frames, if any: true once it is over. */
  private waiter: (() => boolean) | null = null;

  constructor(private readonly deps: StartPrepDeps) {}

  /** A preparation is under way (the game loop draws nothing meanwhile). */
  get active(): boolean {
    return this.running;
  }

  async run(onProgress: (done: number, stage: PrepareStage) => void): Promise<void> {
    const generation = ++this.generation;
    const live = () => generation === this.generation;
    // An older run waiting on frames sees it is no longer live and ends.
    this.tick();
    this.running = true;
    let base = 0;
    let shown = 0;
    let current: PrepareStage = "models";
    const report = (stage: PrepareStage, share: number): void => {
      // A file that answers after its stage gave up reports nothing.
      if (!live() || stage !== current) return;
      shown = Math.max(shown, base + STAGE_WEIGHT[stage] * Math.max(0, Math.min(1, share)));
      onProgress(shown, stage);
    };
    const next = (stage: PrepareStage): void => {
      report(stage, 1);
      base += STAGE_WEIGHT[stage];
      current = PREPARE_STAGES[PREPARE_STAGES.indexOf(stage) + 1] ?? stage;
    };
    try {
      report("models", 0);
      await this.files(live, async () => {
        const files = await this.deps.modelFiles();
        let loaded = 0;
        await Promise.all(files.map((f) => f.then(ignore, ignore).then(() => report("models", ++loaded / files.length))));
      });
      next("models");
      if (!live()) return;
      await this.files(live, () => this.deps.cityKit());
      next("cityKit");
      if (!live()) return;
      await this.cityStage(report, live);
      next("city");
      if (!live()) return;
      // Capped by frames too: a material that never compiles must not hold the start.
      await Promise.race([this.deps.sceneReady().catch(ignore), this.frames(live, () => false)]);
      report("shaders", 0.5);
      if (!live()) return;
      await this.warmUp(report, live);
      next("shaders");
    } finally {
      if (live()) this.running = false;
    }
  }

  /** Waits for downloads, failed or not, for `MAX_FILE_FRAMES` frames at most. */
  private files(live: () => boolean, load: () => Promise<unknown>): Promise<void> {
    return Promise.race([load().then(ignore, ignore), this.frames(live, () => false, MAX_FILE_FRAMES)]);
  }

  /** The city settles round the camera, built a few cells per frame; the bar follows the cells left. */
  private cityStage(report: (stage: PrepareStage, share: number) => void, live: () => boolean): Promise<void> {
    let peak = 0;
    let calm = 0;
    report("city", 0);
    return this.frames(live, () => {
      const waiting = this.deps.cityWaiting();
      peak = Math.max(peak, waiting);
      calm = waiting === 0 ? calm + 1 : 0;
      report("city", peak > 0 ? 1 - waiting / peak : calm / SETTLED_FRAMES);
      return calm >= SETTLED_FRAMES;
    });
  }

  /** Warm-up frames under the loading screen, paced by the GPU (G-029), until the scene stays ready. */
  private warmUp(report: (stage: PrepareStage, share: number) => void, live: () => boolean): Promise<void> {
    let drawn = 0;
    return this.frames(live, () => {
      if (!this.deps.canDraw()) return false;
      this.deps.draw();
      drawn++;
      report("shaders", 0.5 + 0.5 * Math.min(1, drawn / WARM_FRAMES));
      return drawn >= WARM_FRAMES && this.deps.isReady();
    });
  }

  /** Resolves once `done` holds in a tick, after `max` ticks, or when a newer run took over. */
  private frames(live: () => boolean, done: () => boolean, max = MAX_STAGE_FRAMES): Promise<void> {
    return new Promise((resolve) => {
      let count = 0;
      this.waiter = () => {
        count++;
        if (live() && !done() && count < max) return false;
        resolve();
        return true;
      };
    });
  }

  /** Ends the run under way, which draws and reports nothing more (back to the title). */
  cancel(): void {
    this.generation++;
    this.running = false;
    this.tick();
  }

  /** Call once per renderer frame, after the scene was updated: drives the stage waiting on frames. */
  tick(): void {
    const waiter = this.waiter;
    if (waiter?.() && this.waiter === waiter) this.waiter = null;
  }
}

/** What the renderer hands its start preparation besides the scene (ADR-0057). */
export interface StartPrepHost {
  readonly stage: Stage;
  readonly modelFiles: StartPrepDeps["modelFiles"];
  readonly cityKit: StartPrepDeps["cityKit"];
  readonly cityWaiting: StartPrepDeps["cityWaiting"];
}

/** The renderer's preparation over its Babylon scene: its readiness, its pacer and its frames. */
export const sceneStartPrep = ({ stage, modelFiles, cityKit, cityWaiting }: StartPrepHost): StartPrep => {
  const { scene, pacer } = stage;
  return new StartPrep({
    modelFiles,
    cityKit,
    cityWaiting,
    sceneReady: () => scene.whenReadyAsync(true),
    isReady: () => scene.isReady(true),
    canDraw: () => pacer.canDraw,
    draw: () => {
      scene.render();
      pacer.drawn();
    },
  });
};

/**
 * Compiles the bare-structure skins (ADR-0027) when the renderer is made, so the first pillar or
 * wall that streams in does not stall a frame on a shader compile.
 */
export const warmUpMaterials = (scene: Scene, materials: ToonMaterials, signage: Signage): void => {
  const probe = MeshBuilder.CreateBox("material-warmup", { size: 0.01 }, scene);
  probe.isVisible = false;
  probe.isPickable = false;
  let left = 2;
  for (const preset of ["concreteBare", "metalPanel"] as const) {
    materials.get(preset).forceCompilation(probe, () => {
      left -= 1;
      if (left === 0) probe.dispose();
    });
  }
  // The holo shader too (ADR-0030); the gameplay post-process compiles when it is created.
  signage.warmUp();
};
