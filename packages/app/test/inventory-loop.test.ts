import { describe, expect, it } from "vitest";
import { type AudioCue, type AudioPort, EMPTY_INPUT, type EffectDescriptor, type InputFrame, type RenderPort } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { SIM_DT, ground } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";

class FakeRender implements RenderPort {
  effects: EffectDescriptor[] = [];
  spawn() {}
  updateTransform() {}
  despawn() {}
  clear() {}
  setCameraMode() {}
  attachCamera() {}
  playEffect(e: EffectDescriptor) {
    this.effects.push(e);
  }
  setAppearance() {}
}

class FakeAudio implements AudioPort {
  cues: AudioCue[] = [];
  play(c: AudioCue) {
    this.cues.push(c);
  }
  stopAll() {}
}

const setup = () => {
  const ui = createUiStore();
  const render = new FakeRender();
  const audio = new FakeAudio();
  const persistence = new SavePersistence(new MemorySaveStore());
  const session = new GameSession({ render, audio, persistence, ui, story: STORY_SOURCE, seed: () => 77, now: () => new Date(2026, 9, 27, 22, 0) });
  session.newGame();
  return { session, ui, render, audio, persistence };
};

const frame = (p: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...p });

const steps = (s: GameSession, n: number, input: InputFrame = EMPTY_INPUT) => {
  for (let i = 0; i < n; i++) s.step(input);
  s.render(0);
};

describe("HUD weapon strip from the game", () => {
  it("shows the starter pistol with 12 of 48 and follows shots and the reload", () => {
    const { session, ui, render } = setup();
    session.render(0);
    const first = ui.getState().weapons;
    expect(first).toMatchObject({ active: "secondary", loaded: 12, magazine: 12, reserve: 48, ammoName: "ammo.9mm", reloading: false });
    expect(first?.slots.map((s) => s.name)).toEqual([null, "item.unity9.name", null]);
    steps(session, 1);
    // Nothing changed: the same object, so React does not re-render.
    expect(ui.getState().weapons).toBe(first);
    steps(session, Math.ceil(4 / SIM_DT), frame({ fire: true }));
    expect(ui.getState().weapons).toMatchObject({ loaded: 0, reloading: true });
    expect(render.effects).toContainEqual({ kind: "reload", entityId: session.sim.player()!.id, duration: 1.4 });
    steps(session, Math.ceil(1.5 / SIM_DT));
    expect(ui.getState().weapons).toMatchObject({ loaded: 12, reserve: 36, reloading: false });
  });

  it("marks the weapon holstered", () => {
    const { session, ui } = setup();
    steps(session, 1, frame({ toggleWeapon: true }));
    expect(ui.getState().weapons?.holstered).toBe(true);
  });
});

const teleport = (s: GameSession, x: number, z: number, yaw = 0, pitch = 0) => {
  const p = s.sim.player()!;
  p.position = ground(x, z);
  p.prevPosition = p.position;
  p.yaw = yaw;
  p.pitch = pitch;
};

/** Shoots the guard down on the deptak by the clinic (cover in the car wash yard must not matter). */
const shootGuard = (s: GameSession) => {
  for (let i = 0; i < 3000; i++) {
    const guard = [...s.sim.world].find((e) => e.key === "guard");
    if (!guard) return;
    guard.position = ground(300, -79);
    guard.prevPosition = guard.position;
    teleport(s, 300, -83, 0, 0.08);
    s.step(frame({ fire: true }));
  }
  throw new Error("the guard survived");
};

describe("loot loop: kill, bag, take, save, load (plan E6)", () => {
  it("a killed ganger leaves a bag; searching it and taking all fills the pockets, and a save keeps them", async () => {
    const { session, ui, persistence } = setup();
    shootGuard(session);
    steps(session, 1);
    const container = session.sim.domain.loot.containers.find((c) => c.key === "loot:guard")!;
    expect(container).toBeDefined();
    const eddies = container.lines.find((l) => l.kind === "eddies")!.qty;
    const wallet = session.sim.domain.wallet.eddies;

    // Stand next to the bag: the prompt says "Search", E opens the panel.
    teleport(session, container.position.x, container.position.z - 1);
    steps(session, 1);
    expect(ui.getState().prompt).toBe("Search");
    steps(session, 1, frame({ interact: true }));
    const panel = ui.getState().loot!;
    expect(panel.key).toBe("loot:guard");
    expect(panel.owner).toBe("ganger");
    expect(panel.lines[0]).toMatchObject({ kind: "eddies", label: "€$", qty: eddies });
    expect(session.inControl).toBe(false);
    expect(await session.saves.saveAsync("slot-1")).toBe(false);

    session.intents.takeLoot("all");
    steps(session, 1);
    expect(session.sim.domain.wallet.eddies).toBe(wallet + eddies);
    expect(session.sim.domain.loot.containers.filter((c) => !c.key.startsWith("stash:"))).toEqual([]);
    expect(ui.getState().loot).toBeNull();
    steps(session, 1);
    expect(session.inControl).toBe(true);
    expect(session.sim.session.dialogueActive).toBe(false);
    expect(ui.getState().toasts.some((t) => t.title === "Loot")).toBe(true);
    expect(ui.getState().toasts.some((t) => t.text === "Przelew od Kaito")).toBe(false);

    const pockets = { wallet: session.sim.domain.wallet, inventory: session.sim.domain.inventory, ammo: session.sim.domain.ammo };
    expect(await session.saves.saveAsync("slot-1")).toBe(true);
    session.newGame();
    expect(await session.saves.loadAsync("slot-1")).toBe(true);
    expect({ wallet: session.sim.domain.wallet, inventory: session.sim.domain.inventory, ammo: session.sim.domain.ammo }).toEqual(pockets);
    expect((await persistence.load("slot-1"))?.domain.flags).toContain("dead:guard");
  });

  it("a bag left lying is still there after loading", async () => {
    const { session } = setup();
    shootGuard(session);
    steps(session, 1);
    expect(await session.saves.saveAsync("slot-2")).toBe(true);
    session.newGame();
    expect(await session.saves.loadAsync("slot-2")).toBe(true);
    steps(session, 1);
    expect(session.sim.domain.loot.containers.map((c) => c.key).filter((k) => !k.startsWith("stash:"))).toEqual(["loot:guard"]);
    expect([...session.sim.world.with("lootBag")].filter((b) => !b.lootBag.key.startsWith("stash:"))).toHaveLength(1);
  });

  it("Esc leaves the bag as it is; taking one line keeps the panel open", () => {
    const { session, ui } = setup();
    shootGuard(session);
    steps(session, 1);
    const c = session.sim.domain.loot.containers[0]!;
    teleport(session, c.position.x, c.position.z - 1);
    steps(session, 1, frame({ interact: true }));
    session.intents.takeLoot(c.lines.length - 1);
    steps(session, 1);
    expect(ui.getState().loot?.lines).toHaveLength(c.lines.length - 1);
    session.intents.closeLoot();
    session.intents.closeLoot();
    steps(session, 1);
    expect(ui.getState().loot).toBeNull();
    expect(session.inControl).toBe(true);
    expect(session.sim.domain.loot.containers[0]?.lines).toHaveLength(c.lines.length - 1);
    session.intents.takeLoot("all");
    steps(session, 1);
    expect(session.sim.domain.loot.containers[0]?.lines).toHaveLength(c.lines.length - 1);
  });
});
