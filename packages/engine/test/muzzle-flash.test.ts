import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { AppearanceDescriptor, Transform } from "@seki/core";
import { describe, expect, it, vi } from "vitest";
import { type AbstractMesh, FreeCamera, GlowLayer, Scene, Vector3 } from "../src/babylon";
import { CameraRig } from "../src/camera/camera-rig";
import { viewmodelPose } from "../src/camera/viewmodel-poses";
import { Effects } from "../src/effects/effects";
import { MuzzleFx } from "../src/effects/muzzle-fx";
import { FLASH_LIFE, FLASH_POOL, MuzzleState, type Point, REDUCED_FLASH, SMOKE_POOL } from "../src/effects/muzzle-state";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterKit } from "../src/renderer/character-kit";
import { buildHeroine } from "../src/renderer/characters";
import { ModelLibrary } from "../src/renderer/model-library";
import { MuzzleSource } from "../src/renderer/muzzle-source";
import { type GunKind, MUZZLE, muzzleInMount } from "../src/renderer/weapon-mount";
import { allWeaponUrls } from "./weapon-files";

const GUNS: readonly GunKind[] = ["pistol", "revolver", "smg", "shotgun", "rifle"];
const DT = 1 / 60;

const armed = (gun: GunKind): AppearanceDescriptor => ({
  weapons: { primary: gun === "pistol" || gun === "revolver" ? "rifle" : gun, secondary: gun === "revolver" ? "revolver" : "pistol", melee: "baton", active: gun === "pistol" || gun === "revolver" ? "secondary" : "primary" },
  garments: {},
  implants: [],
});

const stand: Transform = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 };

describe("muzzle flash: where the flame comes out (FPP, TPP, NPCs)", () => {
  const setup = () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const camera = new CameraRig(scene, materials, () => false);
    const player = 1;
    const npc = 2;
    const kit = new CharacterKit({ scene, materials, shadow: { addCaster: () => {} } as unknown as MoonShadow, camera, cameraTarget: () => player, library: new ModelLibrary(scene, materials) });
    kit.setWeaponModels(allWeaponUrls());
    const rigs = new Map([
      [player, buildHeroine(scene, materials, "hero")],
      [npc, buildHeroine(scene, materials, "npc")],
    ]);
    const holders = { muzzleOf: (id: number, at: Vector3, dir: Vector3) => kit.loadouts.muzzle(rigs.get(id)!, at, dir) };
    const source = new MuzzleSource(camera, holders, (id) => id === player);
    return { scene, camera, kit, player, npc, rigs, source };
  };

  /** The gun's barrel end in the world, read off its mesh: the file's (max x, bore height) and the file's +X. */
  const barrelOf = (meshes: readonly AbstractMesh[], gun: GunKind) => {
    const mesh = meshes.find((m) => m.isEnabled() && m.getTotalVertices() > 0)!;
    const world = mesh.computeWorldMatrix(true);
    const max = mesh.getBoundingInfo().boundingBox.maximum.x;
    const at = Vector3.TransformCoordinates(new Vector3(max, MUZZLE[gun].y, 0), world);
    const dir = Vector3.TransformNormal(new Vector3(1, 0, 0), world).normalize();
    return { at, dir, max };
  };
  const place = (source: MuzzleSource, id: number) => {
    const at: Point = { x: 0, y: -50, z: 0 };
    const dir: Point = { x: 0, y: 0, z: 0 };
    const kind = source.place(id, at, dir);
    return { kind, at: new Vector3(at.x, at.y, at.z), dir: new Vector3(dir.x, dir.y, dir.z) };
  };

  it.each(GUNS)("%s: the table's muzzle is the file's barrel end and the FPP pose's muzzle", (gun) => {
    const view = muzzleInMount(gun, "view");
    const pose = viewmodelPose(gun).muzzle;
    expect(Vector3.Distance(view.at, new Vector3(pose.x, pose.y, pose.z)), "pose muzzle").toBeLessThan(0.002);
    expect(view.dir.z).toBeCloseTo(1);
    expect(muzzleInMount(gun, "hand").dir.y).toBeCloseTo(-1);
  });

  it.each(GUNS)("%s: in FPP from the viewmodel's muzzle, along its barrel", async (gun) => {
    const { camera, kit, player, rigs, source } = setup();
    kit.arm(player, rigs.get(player)!, "hero", armed(gun));
    const vm = () => camera.weaponMount.getChildMeshes(false).filter((m) => m.isEnabled() && m.name !== "vm-gun" && m.getTotalVertices() > 0);
    await vi.waitFor(() => expect(vm().length).toBeGreaterThan(0));
    camera.update(stand, DT);
    const shot = place(source, player);
    expect(source.inView).toBe(true);
    const barrel = barrelOf(vm(), gun);
    expect(barrel.max).toBeCloseTo(MUZZLE[gun].x, 3);
    expect(shot.kind).toBe(gun);
    // The viewmodel's ball hand holds the grip 2 cm off the model's (VIEW_SHIFT): within that.
    expect(Vector3.Distance(shot.at, barrel.at), "at the barrel's end").toBeLessThan(0.025);
    expect(Vector3.Dot(shot.dir, barrel.dir), "along the barrel").toBeGreaterThan(0.99);
  });

  it.each(GUNS)("%s: in TPP and for an NPC from the muzzle of the gun in the hand", async (gun) => {
    const { camera, kit, player, npc, rigs, source } = setup();
    for (const [id, rig] of rigs) {
      kit.arm(id, rig, `e${id}`, armed(gun));
      rig.root.position.x = id * 3;
      rig.root.rotation.y = id;
    }
    const held = (id: number) => {
      const rig = rigs.get(id)!;
      kit.loadouts.update(rig);
      return rig.root.getChildMeshes(false).filter((m) => m.isEnabled() && m.name.includes(`-${gun}`) && m.getTotalVertices() > 0);
    };
    await vi.waitFor(() => expect(held(npc).length * held(player).length).toBeGreaterThan(0));
    camera.setMode("TPP");
    for (let i = 0; i < 120; i++) camera.update(stand, DT);
    expect(camera.muzzlePosition()).toBeNull();
    for (const id of [player, npc]) {
      const shot = place(source, id);
      expect(source.inView).toBe(false);
      const barrel = barrelOf(held(id), gun);
      expect(shot.kind).toBe(gun);
      expect(Vector3.Distance(shot.at, barrel.at), `${id}: at the barrel's end`).toBeLessThan(0.002);
      expect(Vector3.Dot(shot.dir, barrel.dir), `${id}: along the barrel`).toBeGreaterThan(0.999);
    }
  });

  it("without a gun in a hand keeps the simulation's shot origin", () => {
    const { source } = setup();
    const shot = place(source, 99);
    expect(shot.at.y).toBe(-50);
  });
});

describe("muzzle flash: flame and smoke", () => {
  const at: Point = { x: 1, y: 1.4, z: 2 };
  const dir: Point = { x: 0, y: 0, z: 1 };
  const view = { right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, forward: { x: 0, y: 0, z: 1 } };
  const stay = () => {};
  /** Lengths of a matrix's first three rows (the instance's axes). */
  const axes = (m: Float32Array, i = 0) => [0, 1, 2].map((r) => Math.hypot(m[i * 16 + r * 4]!, m[i * 16 + r * 4 + 1]!, m[i * 16 + r * 4 + 2]!));

  it.each(GUNS)("%s: the flame is sized from the table, along the barrel; reduced flashes make it smaller", (gun) => {
    for (const reduced of [false, true]) {
      const s = new MuzzleState();
      s.reduced = reduced;
      s.fire(7, at, dir, MUZZLE[gun].flash);
      s.update(DT, stay);
      const out = new Float32Array(16 * FLASH_POOL);
      expect(s.writeFlashes(out)).toBe(1);
      const [w, , l] = axes(out);
      const k = reduced ? REDUCED_FLASH : 1;
      expect(w).toBeCloseTo(MUZZLE[gun].flash.width * k, 5);
      // The length jitters by up to 15 % shot to shot.
      expect(l! / (MUZZLE[gun].flash.length * k)).toBeGreaterThan(0.84);
      expect(l! / (MUZZLE[gun].flash.length * k)).toBeLessThan(1.16);
      // Along +Z (the barrel), at the muzzle.
      expect(out[10]! / l!).toBeCloseTo(1, 5);
      expect([out[12], out[13], out[14]]).toEqual([at.x, at.y, at.z].map(Math.fround));
    }
  });

  it("orders the flash sizes: handguns small, the SMG medium, the long guns biggest", () => {
    const size = (g: GunKind) => MUZZLE[g].flash.length * MUZZLE[g].flash.width;
    expect(size("pistol")).toBeLessThan(size("revolver"));
    expect(size("revolver")).toBeLessThan(size("smg"));
    expect(size("smg")).toBeLessThan(size("rifle"));
    expect(size("rifle")).toBeLessThan(size("shotgun"));
  });

  it("a flame lives 2-3 frames at 60 fps, and shows at least once at any frame time", () => {
    const s = new MuzzleState();
    const out = new Float32Array(16 * FLASH_POOL);
    s.fire(1, at, dir, MUZZLE.pistol.flash);
    let frames = 0;
    for (let i = 0; i < 10; i++) {
      s.update(DT, stay);
      frames += s.writeFlashes(out);
    }
    expect(frames).toBeGreaterThanOrEqual(2);
    expect(frames).toBeLessThanOrEqual(Math.ceil(FLASH_LIFE / DT));
    const slow = new MuzzleState();
    slow.fire(1, at, dir, MUZZLE.pistol.flash);
    slow.update(0.2, stay);
    expect(slow.writeFlashes(out)).toBe(1);
    slow.update(0.2, stay);
    expect(slow.writeFlashes(out)).toBe(0);
  });

  it("the flame follows the shooter's muzzle while it lives; the smoke stays in the air", () => {
    const s = new MuzzleState();
    s.fire(3, at, dir, MUZZLE.rifle.flash);
    const out = new Float32Array(16 * FLASH_POOL);
    s.update(DT, (id, p) => {
      expect(id).toBe(3);
      p.x = 5;
    });
    s.writeFlashes(out);
    expect(out[12]).toBe(5);
    const puffs = s.puffs.filter((p) => p.live);
    expect(puffs).toHaveLength(MUZZLE.rifle.flash.puffs);
    // Out along the barrel from the muzzle the flame showed at.
    for (const p of puffs) expect(Math.abs(p.at.x - 5)).toBeLessThan(0.01);
  });

  it("smoke rises, spreads, fades and is gone within a second", () => {
    const s = new MuzzleState();
    s.fire(1, at, dir, MUZZLE.shotgun.flash);
    s.update(DT, stay);
    const m = new Float32Array(16 * SMOKE_POOL);
    const c = new Float32Array(4 * SMOKE_POOL);
    s.writePuffs(m, c, view, [0.5, 0.5, 0.5]);
    const size0 = axes(m)[0]!;
    const y0 = s.puffs[0]!.at.y;
    for (let i = 0; i < 18; i++) s.update(DT, stay);
    expect(s.writePuffs(m, c, view, [0.5, 0.5, 0.5])).toBe(MUZZLE.shotgun.flash.puffs);
    expect(s.puffs[0]!.at.y).toBeGreaterThan(y0);
    expect(axes(m)[0]!).toBeGreaterThan(size0 * 1.5);
    // Grey and see-through.
    expect(c[3]).toBeGreaterThan(0.05);
    expect(c[3]).toBeLessThan(0.6);
    const alpha = c[3]!;
    for (let i = 0; i < 9; i++) s.update(DT, stay);
    s.writePuffs(m, c, view, [0.5, 0.5, 0.5]);
    expect(c[3]).toBeLessThan(alpha);
    // Lives of 0.5 to 1 s: all gone after one.
    for (let i = 0; i < 33; i++) s.update(DT, stay);
    expect(s.livePuffs).toBe(0);
  });

  it("an SMG burst does not pile up: fixed pools, two draw calls at most, nothing made per shot", () => {
    const scene = new Scene(new NullEngine());
    const fx = new MuzzleFx(scene);
    const meshes = scene.meshes.length;
    const materials = scene.materials.length;
    let most = { flames: 0, puffs: 0 };
    // 900 rounds a minute for 5 s, from two shooters.
    for (let i = 0; i < 300; i++) {
      if (i % 4 === 0) fx.fire(1, at, dir, MUZZLE.smg.flash);
      if (i % 4 === 2) fx.fire(2, { x: 4, y: 1.4, z: 2 }, dir, MUZZLE.smg.flash);
      fx.update(DT, stay, view);
      most = { flames: Math.max(most.flames, fx.state.liveFlashes), puffs: Math.max(most.puffs, fx.state.livePuffs) };
      const drawn = [fx.flame, fx.smoke].filter((m) => m.isEnabled());
      expect(drawn.length).toBeLessThanOrEqual(2);
    }
    expect(scene.meshes.length).toBe(meshes);
    expect(scene.materials.length).toBe(materials);
    expect(most.flames).toBeLessThanOrEqual(2);
    expect(most.puffs).toBeLessThanOrEqual(SMOKE_POOL);
    expect(fx.smoke.thinInstanceCount).toBeLessThanOrEqual(SMOKE_POOL);
    for (let i = 0; i < 70; i++) fx.update(DT, stay, view);
    expect(fx.flame.isEnabled()).toBe(false);
    expect(fx.smoke.isEnabled()).toBe(false);
  });

  it("the old glowing sphere at the shot's origin is gone: tracers and sparks only", () => {
    const scene = new Scene(new NullEngine());
    new Effects(scene, new GlowLayer("glow", scene));
    expect(scene.meshes.filter((m) => m.name.startsWith("fx-flash"))).toEqual([]);
    expect(scene.meshes.filter((m) => m.name.startsWith("fx-tracer")).length).toBeGreaterThan(0);
  });

  it("the puffs' grey and opacity reach the shader, whatever was drawn before the first shot", () => {
    const scene = new Scene(new NullEngine());
    new FreeCamera("eye", new Vector3(0, 1.4, -3), scene);
    const fx = new MuzzleFx(scene);
    // Drawn (or readied, as the loading screen does) before any puff.
    for (const m of [fx.flame, fx.smoke]) m.setEnabled(true);
    scene.render();
    fx.update(DT, stay, view);
    fx.fire(1, at, dir, MUZZLE.pistol.flash);
    fx.update(DT, stay, view);
    scene.render();
    const defines = (fx.smoke.subMeshes[0] as unknown as { materialDefines: Record<string, unknown> }).materialDefines;
    expect(defines["INSTANCESCOLOR"]).toBe(true);
    expect(fx.smoke.material!.needAlphaBlendingForMesh(fx.smoke)).toBe(true);
  });

  it("reduced flashes darken the flame", () => {
    const fx = new MuzzleFx(new Scene(new NullEngine()));
    const glow = () => (fx.flame.material as unknown as { emissiveColor: { r: number } }).emissiveColor.r;
    expect(glow()).toBe(1);
    fx.setReduced(true);
    expect(glow()).toBeLessThan(0.7);
    expect(fx.state.reduced).toBe(true);
    fx.setReduced(false);
    expect(glow()).toBe(1);
  });
});
