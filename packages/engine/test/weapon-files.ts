// @ts-expect-error The engine is typed for the browser; the tests read the files off disk.
import { readFileSync } from "node:fs";
import type { WeaponKind } from "../src/renderer/weapon-mount";

/** A weapon model of `packages/app/public/weapons` as a data URL, as the game would load it. */
export const weaponUrl = (file: WeaponKind): string => {
  const bytes = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/weapons/${file}.glb`, import.meta.url));
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:model/gltf-binary;base64,${btoa(text)}`;
};

/** Every weapon model file, as the game's manifest lists them. */
export const allWeaponUrls = (): Record<WeaponKind, string> => ({
  pistol: weaponUrl("pistol"),
  revolver: weaponUrl("revolver"),
  smg: weaponUrl("smg"),
  shotgun: weaponUrl("shotgun"),
  rifle: weaponUrl("rifle"),
  baton: weaponUrl("baton"),
  blade: weaponUrl("blade"),
});
