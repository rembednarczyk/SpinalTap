import type { WeaponLook } from "@seki/core";
import type { TransformNode } from "../babylon";
import type { CameraRig } from "../camera/camera-rig";
import { WEAPON_MODEL, type WeaponKind, type WeaponMounts, isMeleeKind } from "./weapon-mount";

/**
 * The gun model of the FPP viewmodel (G-282): the model of the weapon in hand, sized as in the
 * hands in TPP. Each model file is mounted once, on first use, and only the one in hand is
 * enabled, so the view draws one weapon model whatever the player switched through. Until it
 * loads, and for a look without a file, the camera's box pistol stands in. A baton or blade hangs
 * under the camera's melee holder, which swings and guards, in place of its stand-in shape.
 */
export class ViewWeapon {
  /** Mounted models by file; null while loading or after a failed load. */
  private readonly pivots = new Map<WeaponKind, TransformNode | null>();
  private look: WeaponLook | null = null;
  /** Bumped with each new manifest, so a mount of the old one is dropped when it resolves. */
  private generation = 0;

  constructor(
    private readonly mounts: WeaponMounts,
    private readonly camera: CameraRig,
  ) {}

  /** The weapon models changed: the mounted ones go, the weapon in hand is mounted again. */
  reset(): void {
    this.generation++;
    for (const pivot of this.pivots.values()) pivot?.dispose();
    this.pivots.clear();
    this.refresh();
  }

  show(look: WeaponLook | null): void {
    this.look = look;
    this.refresh();
  }

  private refresh(): void {
    // An empty hand keeps the pistol, as the viewmodel showed before it followed the weapon.
    const model = WEAPON_MODEL[this.look ?? "pistol"];
    const kind = model.kind;
    for (const [k, pivot] of this.pivots) pivot?.setEnabled(k === kind);
    const pivot = kind ? this.pivots.get(kind) : null;
    const melee = kind !== null && isMeleeKind(kind);
    if (kind && pivot) {
      pivot.scaling.setAll(model.scale);
      this.camera.setPlaceholderGun(melee);
      this.camera.setPlaceholderMelee(!melee);
      return;
    }
    this.camera.setPlaceholderGun(true);
    this.camera.setPlaceholderMelee(true);
    if (kind && pivot === undefined && this.mounts.has(kind)) this.load(kind);
  }

  private load(kind: WeaponKind): void {
    const generation = this.generation;
    this.pivots.set(kind, null);
    const holder = isMeleeKind(kind) ? this.camera.meleeMount : this.camera.weaponMount;
    void this.mounts.mount(holder, kind, `vm-${kind}`, "view").then((pivot) => {
      if (generation !== this.generation) return pivot?.dispose();
      if (!pivot) return;
      this.pivots.set(kind, pivot);
      this.refresh();
    });
  }
}
