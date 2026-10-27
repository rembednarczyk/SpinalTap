import {
  type AppearanceDescriptor,
  appearanceOf,
  type DomainState,
  HIT_ZONES,
  type HitZone,
  spreadAngle,
  usesAmmo,
  weaponStatsOf,
  wornGarments,
  zoneArmor,
} from "@seki/core";
import { playerStatsOf } from "@seki/sim";
import type { CharacterStatsVm, PreviewRect } from "@seki/ui";

/**
 * What the app hands the 3D preview of the character menu (plan §8.5). The engine's
 * PreviewStage implements it; tests use a recording fake.
 */
export interface PreviewHost {
  setViewport(rect: PreviewRect | null): void;
  setAppearance(appearance: AppearanceDescriptor): void;
  rotate(deltaYaw: number): void;
  reset(): void;
}

/** The player's appearance from the domain, the same descriptor the world renderer gets. */
export const playerAppearance = (domain: DomainState): AppearanceDescriptor =>
  appearanceOf(domain.inventory, domain.equipment, domain.character.cyberware);

/** Memoised on the parts of the domain the look depends on, so it is rebuilt only on change. */
export const createAppearanceCache = () => {
  let key: readonly unknown[] = [];
  let last: AppearanceDescriptor | null = null;
  return (domain: DomainState): AppearanceDescriptor => {
    const next = [domain.equipment, domain.inventory.items, domain.character.cyberware];
    if (last && next.every((v, i) => v === key[i])) return last;
    key = next;
    last = playerAppearance(domain);
    return last;
  };
};

/**
 * Numbers of the menu's stats panel: HP, armor per zone with clothes, crits and the aim cone
 * of the weapon in hand standing still, all from the rules the game fights with.
 */
export const characterStats = (domain: DomainState, hp: number, maxHp: number): CharacterStatsVm => {
  const stats = playerStatsOf(domain);
  const worn = wornGarments(domain.inventory, domain.equipment);
  const armor = {} as Record<HitZone, number>;
  for (const z of HIT_ZONES) armor[z] = zoneArmor(stats, worn, z);
  const weapon = weaponStatsOf(domain.inventory, domain.equipment[domain.equipment.active]);
  const spread =
    weapon && usesAmmo(weapon)
      ? (spreadAngle(weapon.spread, { crouch: 0, moving: 0, sprinting: false, bloom: 0, aimStability: stats.aimStability }) * 180) / Math.PI
      : null;
  return { hp, maxHp, armor, critChance: stats.critChance, critMultiplier: stats.critMultiplier, spread, moveSpeed: stats.moveSpeed };
};

/** Same object while nothing it shows changed, so the store is not touched every frame. */
export const createStatsCache = () => {
  let key: readonly unknown[] = [];
  let last: CharacterStatsVm | null = null;
  return (domain: DomainState, hp: number, maxHp: number): CharacterStatsVm => {
    const next = [domain.character, domain.equipment, domain.inventory.items, hp, maxHp];
    if (last && next.every((v, i) => v === key[i])) return last;
    key = next;
    last = characterStats(domain, hp, maxHp);
    return last;
  };
};
