import type { AppearanceDescriptor, EntityId, WeaponLook } from "@seki/core";
import type { Scene } from "../babylon";
import type { CameraRig } from "../camera/camera-rig";
import type { MoonShadow } from "../npr/moon-shadow";
import type { ToonMaterials } from "../npr/toon-material";
import type { CharacterRig } from "./characters";
import { Loadouts } from "./loadout";
import type { ModelLibrary } from "./model-library";
import { type WeaponManifest, WeaponMounts } from "./weapon-mount";

export interface CharacterKitDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  readonly shadow: MoonShadow;
  readonly camera: CameraRig;
  readonly cameraTarget: () => EntityId | null;
  readonly library: ModelLibrary;
}

/**
 * What the characters wear and carry (ADR-0015), a part behind `CharacterViews`: weapon models
 * (also the FPP viewmodel's), the loadouts of weapons and garment add-ons per rig, and the
 * weapon in hand per character, so the viewmodel can follow whoever the camera takes.
 */
export class CharacterKit {
  private readonly weapons: WeaponMounts;
  /** Weapons and garment add-ons per character, from `setAppearance`. */
  readonly loadouts: Loadouts;
  private readonly held = new Map<EntityId, WeaponLook | null>();

  constructor(private readonly deps: CharacterKitDeps) {
    this.weapons = new WeaponMounts(deps.library);
    this.loadouts = new Loadouts(deps.scene, deps.materials, this.weapons, (meshes) => {
      for (const m of meshes) deps.shadow.addCaster(m);
    });
  }

  heldOf(id: EntityId): WeaponLook | null {
    return this.held.get(id) ?? null;
  }

  /** The character is gone: its weapon in hand is forgotten (its loadout goes with the rig). */
  forget(id: EntityId): void {
    this.held.delete(id);
  }

  /** Weapon models instead of the placeholder box pistols; characters on screen are re-armed. */
  setWeaponModels(manifest: WeaponManifest): void {
    const camera = this.deps.camera;
    this.weapons.setManifest(manifest);
    this.loadouts.remountAll();
    if (this.weapons.has("pistol")) {
      void this.weapons.mount(camera.weaponMount, "pistol", "vm-weapon", "view").then((pivot) => {
        if (pivot) camera.hidePlaceholderGun();
      });
    }
  }

  /** Starts loading every weapon file, one promise per file (ADR-0057). */
  preload(): Promise<unknown>[] {
    return this.weapons.preload();
  }

  /** Weapons in hand, holster and on the back, garment add-ons, for a rig that can aim. */
  arm(id: EntityId, rig: CharacterRig, name: string, appearance: AppearanceDescriptor): void {
    const w = appearance.weapons;
    // A baton or blade in hand swings and guards instead of aiming (ADR-0019).
    rig.melee = w.active === "melee" && w.melee !== null;
    this.held.set(id, w[w.active]);
    if (id === this.deps.cameraTarget()) this.deps.camera.setHeldWeapon(w[w.active]);
    this.loadouts.set(rig, appearance, name);
  }
}
