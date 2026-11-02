import type { PrepareStage, Vec3 } from "@seki/core";
import type { MoonShadow } from "../npr/moon-shadow";
import type { ToonMaterials } from "../npr/toon-material";
import type { CharacterViews } from "./character-views";
import type { CharacterModelManifest } from "./model-library";
import { type StartPrep, sceneStartPrep } from "./start-prep";
import type { Stage } from "./stage";
import type { WeaponManifest } from "./weapon-mount";

export interface RendererLoadingDeps {
  readonly stage: Stage;
  readonly materials: ToonMaterials;
  readonly shadow: MoonShadow;
  readonly characters: CharacterViews;
  /** The city kit and the facade props have loaded or failed. */
  readonly cityKit: () => Promise<unknown>;
  /** Near cells of the map city still waiting for their detailed buildings. */
  readonly cityWaiting: () => number;
}

/**
 * What a game loads before it starts, behind the `BabylonRenderer` facade (ADR-0057): the model
 * manifests of the characters and the weapons, and the loading screen's work that waits for them.
 */
export class RendererLoading {
  private readonly prep: StartPrep;
  private modelManifest: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: RendererLoadingDeps) {
    const modelFiles = () => this.modelManifest.then(() => deps.characters.preloadModels());
    this.prep = sceneStartPrep({ stage: deps.stage, modelFiles, cityKit: deps.cityKit, cityWaiting: deps.cityWaiting });
  }

  /** The start of a game behind the loading screen (ADR-0057); the moon shadow goes on `at` first. */
  prepare(at: Vec3, onProgress: (done: number, stage: PrepareStage) => void): Promise<void> {
    const moved = this.deps.shadow.update(at);
    if (moved) this.deps.materials.setShadowMatrix(moved);
    return this.prep.run(onProgress);
  }

  /** The start under way leads nowhere any more (back to the title). */
  cancel(): void {
    this.prep.cancel();
  }

  /** Drives the stages that wait on frames; called at the end of every frame. */
  tick(): void {
    this.prep.tick();
  }

  /**
   * Weapon models (glTF) that replace the placeholder box pistols in hands, holsters, the FPP
   * viewmodel and the hands of imported characters. Characters on screen are re-armed.
   */
  setWeaponModels(manifest: WeaponManifest): void {
    this.deps.characters.setWeaponModels(manifest);
  }

  /** Imported character models (models/manifest.json); characters on screen are dressed too. */
  setCharacterModels(manifest: CharacterModelManifest): void {
    this.deps.characters.setCharacterModels(manifest);
  }

  /** The manifest once it arrives (ADR-0057): the loading screen waits for it, then for its files. */
  loadCharacterModels(manifest: Promise<CharacterModelManifest>): void {
    this.modelManifest = manifest.then((m) => Object.keys(m).length > 0 && this.setCharacterModels(m), () => {});
  }
}
