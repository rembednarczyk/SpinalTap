import { describe, expect, it, vi } from "vitest";
import { type AudioPort, type DomainState, EMPTY_INPUT, type RenderPort, createDomainState } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { DISTRICT_M0_PROPS, type Entity, KANAL_PROPS, TARG_NORTH_PROPS, TARG_SOUTH_PROPS } from "@seki/sim";
import { DEFAULT_SETTINGS, createUiStore } from "@seki/ui";
import { GameSession, type SettingsHost } from "../src/game-session";
import { buildJournal, createJournalCache } from "../src/journal";
import { buildDistrictMap, createMinimapTracker } from "../src/minimap";
import { SETTINGS_KEY, loadSettings, sanitizeSettings, saveSettings, scaleLook } from "../src/settings";

const render: RenderPort = {
  spawn() {},
  updateTransform() {},
  despawn() {},
  clear() {},
  setCameraMode() {},
  attachCamera() {},
  playEffect() {},
  setAppearance() {},
};
const audio: AudioPort = { play() {}, stopAll() {} };

const session = (settings?: SettingsHost) => {
  const ui = createUiStore();
  const s = new GameSession({
    render,
    audio,
    persistence: new SavePersistence(new MemorySaveStore()),
    ui,
    story: STORY_SOURCE,
    seed: () => 7,
    now: () => new Date(2026, 9, 27),
    ...(settings ? { settings } : {}),
  });
  return { s, ui };
};

describe("journal view model", () => {
  it("shows the reached steps of the first contract and nothing else at the start", () => {
    const j = buildJournal(createDomainState());
    expect(j.memories).toEqual([]);
    expect(j.quests).toHaveLength(1);
    expect(j.quests[0]).toMatchObject({ id: "m0_first_contract", kind: "main", status: "active" });
    expect(j.quests[0]?.steps).toEqual([{ objective: expect.stringContaining("fixera"), done: false }]);
  });

  it("marks done steps, lists contracts and memories", () => {
    const base = createDomainState();
    const domain: DomainState = {
      ...base,
      character: { ...base.character, memories: ["combat_reflex"] },
      quests: { m0_first_contract: { status: "completed" } },
      contracts: { active: { id: "c3", siteId: "car_wash", targets: 3, reward: 625, status: "cleared" }, completed: 2 },
    };
    const j = buildJournal(domain);
    const main = j.quests.find((q) => q.id === "m0_first_contract");
    expect(main?.status).toBe("completed");
    expect(main?.steps.every((s) => s.done)).toBe(true);
    expect(main?.steps).toHaveLength(3);
    const contract = j.quests.find((q) => q.id === "contract-c3");
    expect(contract?.title).toBe("Kontrakt 3 · Kaito");
    expect(contract?.steps.map((s) => s.done)).toEqual([true, false]);
    expect(contract?.steps[0]?.objective).toContain("zaułek za myjnią");
    expect(j.quests.find((q) => q.id === "contracts-done")?.steps[0]?.objective).toBe("Wykonane i opłacone: 2");
    expect(j.memories).toEqual([expect.objectContaining({ id: "combat_reflex", title: "Wspomnienie: odruch" })]);
  });

  it("reuses the last view model while the domain parts it reads are unchanged", () => {
    const cache = createJournalCache();
    const d = createDomainState();
    const first = cache(d);
    expect(cache({ ...d, wallet: { eddies: 5 } })).toBe(first);
    expect(cache({ ...d, quests: { ...d.quests } })).not.toBe(first);
  });
});

describe("minimap data", () => {
  it("turns district content into an outline, buildings and sidewalks", () => {
    const map = buildDistrictMap(DISTRICT_M0_PROPS);
    expect(map.bounds).toEqual({ x: 0, z: 7, w: 46, d: 88 });
    expect(map.streets).toHaveLength(2);
    expect(map.blocks.length).toBeGreaterThan(10);
    expect(buildDistrictMap([]).bounds.w).toBe(0);
    // Shinsekai 7 is flat: no upper floors, no stairs.
    expect(map.decks).toBeUndefined();
    expect(map.links).toBeUndefined();
  });

  it("marks floors above the street, stairs, the lift and ladders (ADR-0021)", () => {
    const map = buildDistrictMap([...KANAL_PROPS, ...TARG_SOUTH_PROPS, ...TARG_NORTH_PROPS]);
    const kinds = (map.links ?? []).map((l) => l.kind);
    // The footbridge's two flights and the market stairs; one lift; three fire escape ladders.
    expect(kinds.filter((k) => k === "stairs")).toHaveLength(3);
    expect(kinds.filter((k) => k === "lift")).toHaveLength(1);
    expect(kinds.filter((k) => k === "ladder")).toHaveLength(3);
    // The overpass deck is a floor above, not a building.
    const deck = map.decks?.find((d) => d.w === 60 && d.d === 10);
    expect(deck).toBeDefined();
    expect(map.blocks.some((b) => b.w === 60 && b.d === 10)).toBe(false);
  });

  it("tells the player's height while up on a level", () => {
    const track = createMinimapTracker();
    const contracts = { active: null, completed: 0 } as const;
    const at = (y: number) => ({ id: 1, player: true, position: { x: 96, y, z: 92 }, yaw: 0 }) as unknown as Entity;
    expect(track([at(0)], [], contracts).mapPlayer?.level).toBeUndefined();
    const up = track([at(9.9)], [], contracts).mapPlayer;
    expect(up?.level).toBe(10);
    expect(track([at(9.9)], [], contracts).mapPlayer).toBe(up);
    expect(track([at(0)], [], contracts).mapPlayer?.level).toBeUndefined();
  });

  it("tracks the player and key NPCs, and keeps objects stable when nothing moved", () => {
    const track = createMinimapTracker();
    const player = { id: 1, player: true, position: { x: 1.02, y: 0, z: 2 }, yaw: 0.5 } as unknown as Entity;
    const fixer = { id: 2, key: "fixer", position: { x: 6.2, y: 0, z: 1.5 }, interactable: { kind: "dialogue", dialogueId: "fixer" } } as unknown as Entity;
    const mori = { id: 3, key: "mori", position: { x: -6.2, y: 0, z: 2.4 }, interactable: { kind: "shop", dialogueId: "mori" } } as unknown as Entity;
    const courier = { id: 4, key: "courier", tag: "hebi_courier", health: { current: 80, max: 80 }, position: { x: 1, y: 0, z: 43 } } as unknown as Entity;
    const hired = { id: 5, key: "c1-g0", tag: "contract:c1", health: { current: 80, max: 80 }, position: { x: 3, y: 0, z: 12 } } as unknown as Entity;
    const contracts = { active: { id: "c1", siteId: "koi_back", targets: 1, reward: 1, status: "active" }, completed: 0 } as const;
    const a = track([player, fixer, mori, courier, hired], [], contracts);
    expect(a.mapPlayer).toEqual({ x: 1, z: 2, yaw: expect.closeTo(0.5, 1) });
    expect(a.mapMarkers.map((m) => m.kind)).toEqual(["fixer", "ripperdoc", "target", "target"]);
    const b = track([player, fixer, mori, courier, hired], [], contracts);
    expect(b.mapPlayer).toBe(a.mapPlayer);
    expect(b.mapMarkers).toBe(a.mapMarkers);
    const c = track([player, fixer, mori, courier, hired], ["killed:hebi_courier"], { active: null, completed: 1 });
    expect(c.mapMarkers.map((m) => m.kind)).toEqual(["fixer", "ripperdoc"]);
    expect(track([fixer], [], contracts).mapPlayer).toBeNull();
  });

  it("marks Mori's clinic apart from other shops", () => {
    const track = createMinimapTracker();
    const mori = { id: 3, key: "mori", position: { x: -6, y: 0, z: 2 }, interactable: { kind: "shop", dialogueId: "mori" } } as unknown as Entity;
    const oyaji = { id: 6, key: "oyaji", position: { x: 80, y: 0, z: 66 }, interactable: { kind: "shop", shopId: "oyaji", dialogueId: "oyaji" } } as unknown as Entity;
    expect(track([mori, oyaji], [], { active: null, completed: 0 }).mapMarkers.map((m) => m.kind)).toEqual(["ripperdoc", "vendor"]);
  });

  it("reaches the store through the session", () => {
    const { s, ui } = session();
    expect(ui.getState().map?.blocks.length).toBeGreaterThan(0);
    s.newGame();
    const st = ui.getState();
    expect(st.mapPlayer).toMatchObject({ x: 0, z: -28 });
    expect(st.mapMarkers.map((m) => m.kind).sort()).toEqual(["fixer", "ripperdoc", "target"]);
    expect(st.journal.quests[0]?.title).toBe("Pierwsze zlecenie");
    const before = ui.getState().mapPlayer;
    s.step(EMPTY_INPUT);
    s.render(0);
    expect(ui.getState().mapPlayer).toBe(before);
  });
});

describe("settings", () => {
  const memoryStorage = () => {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
  };

  it("round-trips through storage and survives broken or missing storage", () => {
    const st = memoryStorage();
    expect(loadSettings(st)).toEqual(DEFAULT_SETTINGS);
    const custom = { ...DEFAULT_SETTINGS, quality: "low", aimMode: "toggle", crouchMode: "hold", invertY: true, fov: 70, mouseSensitivity: 2, touchSensitivity: 0.5, volume: 0.3, bindings: { jump: ["KeyJ"] } } as const;
    expect(saveSettings(st, custom)).toBe(true);
    expect(loadSettings(st)).toEqual(custom);
    st.data.set(SETTINGS_KEY, "{not json");
    expect(loadSettings(st)).toEqual(DEFAULT_SETTINGS);
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(throwing, custom)).toBe(false);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(null, custom)).toBe(false);
  });

  it("clamps and fills bad values", () => {
    expect(
      sanitizeSettings({ quality: "ultra", aimMode: "sometimes", crouchMode: 3, mouseSensitivity: 99, touchSensitivity: "x", volume: -1, fov: 200, invertY: "yes", bindings: { jump: ["Space"], fire: "Mouse0", aim: [1] } }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      quality: "high",
      aimMode: "hold",
      mouseSensitivity: 3,
      touchSensitivity: 1,
      volume: 0,
      fov: 80,
      bindings: { jump: ["Space"] },
    });
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("scales only the look axes", () => {
    const f = { ...EMPTY_INPUT, moveZ: 1, lookYaw: 0.1, lookPitch: -0.2 };
    expect(scaleLook(f, 1)).toBe(f);
    expect(scaleLook(EMPTY_INPUT, 2)).toBe(EMPTY_INPUT);
    const s = scaleLook(f, 2);
    expect(s).toMatchObject({ moveZ: 1, lookYaw: 0.2, lookPitch: -0.4 });
    // Inverted Y flips only the pitch.
    expect(scaleLook(f, 1, true)).toMatchObject({ lookYaw: 0.1, lookPitch: 0.2 });
  });

  it("saves every change and asks for a reload only for quality", () => {
    const host = { applied: { ...DEFAULT_SETTINGS, quality: "low" as const }, save: vi.fn(), reload: vi.fn() };
    const { s, ui } = session(host);
    expect(ui.getState().settings.quality).toBe("low");
    s.changeSettings({ mouseSensitivity: 1.8 });
    expect(host.save).toHaveBeenLastCalledWith(expect.objectContaining({ mouseSensitivity: 1.8, quality: "low" }));
    expect(ui.getState().reloadNeeded).toBe(false);
    s.changeSettings({ quality: "high" });
    expect(ui.getState().reloadNeeded).toBe(true);
    s.changeSettings({ quality: "low" });
    expect(ui.getState().reloadNeeded).toBe(false);
    s.changeSettings({ volume: 0.1 });
    expect(ui.getState().reloadNeeded).toBe(false);
    s.reload();
    expect(host.reload).toHaveBeenCalled();
  });

  it("works without a settings host for the session only", () => {
    const { s, ui } = session();
    s.changeSettings({ touchSensitivity: 2.5 });
    expect(ui.getState().settings.touchSensitivity).toBe(2.5);
    s.reload();
  });
});
