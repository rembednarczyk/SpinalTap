import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Matrix, Scene, type TransformNode, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterModels } from "../src/renderer/character-models";
import { buildCivilian, buildGanger } from "../src/renderer/characters";
import { Loadouts } from "../src/renderer/loadout";
import { UPRIGHT } from "../src/renderer/model-figure";
import { ModelLibrary } from "../src/renderer/model-library";
import { normaliseBoneName } from "../src/renderer/model-rig";
import { BACKGROUND_VARIANTS, backgroundVariantOf, variantOf } from "../src/renderer/model-variant";
import { WeaponMounts } from "../src/renderer/weapon-mount";
import { characterUrl, gunShape, insideGun, onGun, skinnedBody } from "./body-geometry";
import { BODY, type Cast, LONG, POINTS, arm, heldGun, palmOf, pose, until } from "./two-hand-cast";
import { allWeaponUrls } from "./weapon-files";

/** Looks whose background variant is an older one, for the street's people. */
const AGED = Array.from({ length: 4000 }, (_, look) => look).filter((look) => variantOf(backgroundVariantOf(look)).figure.stoop > 0);

/** A ganger or a passer-by of `pool` on Base_Male with background look `look`. */
const dressed = async (who: "ganger" | "civilian", look: number): Promise<Cast> => {
  const scene = new Scene(new NullEngine());
  const materials = new ToonMaterials(scene);
  const library = new ModelLibrary(scene, materials);
  const loadouts = new Loadouts(scene, materials, new WeaponMounts(library, allWeaponUrls()), () => {});
  const models = new CharacterModels({ library, loadouts, addCaster: () => {}, scene, materials });
  const file = { url: characterUrl("ganger.vrm"), scale: 1.07 };
  models.setManifest({ ganger: file, civilian: file, pools: { ganger: [file], civilian: [file] } });
  const rig = who === "ganger" ? buildGanger(scene, materials, "c") : buildCivilian(scene, materials, "c", false);
  models.dress(rig, { fallback: who, pool: who, look }, "c");
  await until(() => models.loadingCount === 0);
  const nodes = models.of(rig)!.model.root.getDescendants(false) as TransformNode[];
  const bone = (name: string) => nodes.find((x) => x.name.endsWith(`J_Bip_${name}`))!;
  return { scene, rig, loadouts, models, meshes: models.of(rig)!.model.meshes, bone };
};

/** How far the neck bone is turned from its bind pose (VRoid binds every bone unturned), radians. */
const neckBend = (c: Cast): number => {
  const neck = c.scene.transformNodes.find((n) => normaliseBoneName(n.name, "c-m-") === "cneck")!;
  const q = neck.rotationQuaternion;
  return q ? 2 * Math.acos(Math.min(1, Math.abs(q.w))) : 0;
};

describe("older looks and fighters (ADR-0076 decision 7, G-282)", () => {
  it("never age a background variant asked for without the street's elders", () => {
    expect(AGED.length).toBeGreaterThan(0);
    for (let id = 1; id <= BACKGROUND_VARIANTS; id++) {
      const young = variantOf(id, undefined, false);
      expect(young.figure, `${id}`).toEqual(UPRIGHT);
      // Only the age changes: the rest of the look is the same variant.
      expect({ ...young, hair: null, figure: null }).toEqual({ ...variantOf(id), hair: null, figure: null });
    }
  });

  it("bend a passer-by of an older look, never a ganger of the same look", async () => {
    const look = AGED[0]!;
    const passer = await dressed("civilian", look);
    const ganger = await dressed("ganger", look);
    expect(passer.rig.pace).toBeLessThan(1);
    expect(ganger.rig.pace).toBe(1);
    expect(neckBend(passer)).toBeGreaterThan(0.05);
    expect(neckBend(ganger)).toBeLessThan(1e-6);
  }, 60_000);

  it.each(AGED.slice(0, 3).map((look) => [backgroundVariantOf(look), look]))(
    "keep a ganger of variant %i (look %i) holding a long gun with both hands, clear of his body",
    async (_variant, look) => {
      const c = await dressed("ganger", look);
      for (const kind of LONG) {
        await arm(c, kind);
        for (const aim of [0, 1]) {
          pose(c, aim);
          const gun = gunShape(heldGun(c, kind)!);
          const p = POINTS[kind];
          // The thresholds of two-hand-hold.test.ts.
          expect(Vector3.Distance(palmOf(c, "L"), onGun(gun, ...p.fore)), `${kind} aim ${aim}: left`).toBeLessThan(0.05);
          expect(Vector3.Distance(palmOf(c, "R"), onGun(gun, ...p.grip)), `${kind} aim ${aim}: right`).toBeLessThan(0.05);
          const inverse = Matrix.Invert(gun.world);
          const inside = skinnedBody(c.meshes!, /body|face/i, BODY).filter((v) => insideGun(gun, v.at, inverse, 0.004));
          expect(inside.length, `${kind} aim ${aim}: body vertices inside the gun`).toBe(0);
        }
      }
    },
    60_000,
  );
});
