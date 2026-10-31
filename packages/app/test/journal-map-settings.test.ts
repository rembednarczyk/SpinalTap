import { describe, expect, it, vi } from "vitest";
import { type AudioPort, type DomainState, EMPTY_INPUT, type RenderPort, createDomainState } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { DISTRICT_M0_PROPS, type Entity, KANAL_PROPS, TARG_NORTH_PROPS, TARG_SOUTH_PROPS, ground } from "@seki/sim";
import { DEFAULT_SETTINGS, createUiStore } from "@seki/ui";
import { GameSession, type SettingsHost } from "../src/game-session";
import { buildJournal, createJournalCache } from "../src/journal";
import { buildCityMap, readableAngle } from "../src/city-map";
import { buildDistrictMap, createMinimapTracker } from "../src/minimap";
import { SETTINGS_KEY, applyVolumes, loadSettings, sanitizeSettings, saveSettings, scaleLook } from "../src/settings";

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
    const j = buildJournal(createDomainState(), "en");
    expect(j.memories).toEqual([]);
    expect(j.quests).toHaveLength(1);
    expect(j.quests[0]).toMatchObject({ id: "m0_first_contract", kind: "main", status: "active" });
    expect(j.quests[0]?.steps).toEqual([{ objective: expect.stringContaining("Kaito"), done: false }]);
  });

  it("marks done steps, lists contracts and memories", () => {
    const base = createDomainState();
    const domain: DomainState = {
      ...base,
      character: { ...base.character, memories: ["combat_reflex"] },
      quests: { m0_first_contract: { status: "completed" } },
      contracts: { active: { id: "c3", siteId: "car_wash", targets: 3, reward: 625, status: "cleared" }, completed: 2 },
    };
    const j = buildJournal(domain, "en");
    const main = j.quests.find((q) => q.id === "m0_first_contract");
    expect(main?.status).toBe("completed");
    expect(main?.steps.every((s) => s.done)).toBe(true);
    expect(main?.steps).toHaveLength(3);
    const contract = j.quests.find((q) => q.id === "contract-c3");
    expect(contract?.title).toBe("Contract 3 · Kaito");
    expect(contract?.steps.map((s) => s.done)).toEqual([true, false]);
    expect(contract?.steps[1]?.objective).toBe("Go back to Kaito for your pay");
    expect(buildJournal(domain, "pl").quests.find((q) => q.id === "contract-c3")?.steps[1]?.objective).toBe("Wróć do Kaito po zapłatę");
    expect(contract?.steps[0]?.objective).toContain("the yard behind the car wash");
    expect(j.quests.find((q) => q.id === "contracts-done")).toMatchObject({ title: "Completed contracts", steps: [{ objective: "Done and paid: 2", done: true }] });
    expect(buildJournal(domain, "pl").quests.find((q) => q.id === "contracts-done")).toMatchObject({ title: "Wykonane kontrakty", steps: [{ objective: "Wykonane i opłacone: 2", done: true }] });
    expect(j.memories).toEqual([expect.objectContaining({ id: "combat_reflex", title: "Memory: reflex" })]);
    expect(buildJournal(domain, "pl").memories).toEqual([expect.objectContaining({ id: "combat_reflex", title: "Wspomnienie: odruch" })]);
  });

  it("reuses the last view model while the domain parts it reads are unchanged", () => {
    const cache = createJournalCache();
    const d = createDomainState();
    const first = cache(d, "en");
    expect(cache({ ...d, wallet: { eddies: 5 } }, "en")).toBe(first);
    // A language change rebuilds it in the new language.
    expect(cache(d, "pl")).not.toBe(first);
    expect(cache({ ...d, quests: { ...d.quests } }, "pl")).not.toBe(first);
  });
});

describe("minimap data", () => {
  it("turns the game's blocks into buildings and cover, and nothing into nothing", () => {
    const map = buildDistrictMap(DISTRICT_M0_PROPS);
    expect(map.blocks.length).toBeGreaterThan(10);
    expect(buildDistrictMap([]).bounds.w).toBe(0);
    // Krakowskie Przedmieście's own props have no upper floors and no stairs.
    expect(map.decks).toBeUndefined();
    expect(map.links).toBeUndefined();
  });

  it("draws Lublin from the map: its chunks, surfaces, buildings and names (ADR-0045)", () => {
    const map = buildCityMap();
    expect(map.ground).toHaveLength(20);
    // From the west end of Krakowskie Przedmieście to the east end of Nabrzeże Bystrzycy.
    expect(map.bounds.x - map.bounds.w / 2).toBe(-200);
    expect(map.bounds.x + map.bounds.w / 2).toBe(2700);
    expect(map.buildings!.length).toBeGreaterThan(500);
    // The map's centre has no railway in it.
    expect(new Set(map.areas!.map((a) => a.kind))).toEqual(new Set(["road", "walk", "green", "water"]));
    const names = (kind: string) => map.labels!.filter((l) => l.kind === kind).map((l) => l.text);
    expect(names("street")).toEqual(expect.arrayContaining(["Krakowskie Przedmieście", "Grodzka", "Bramowa", "Lubartowska"]));
    expect(names("district")).toEqual(["Krakowskie Przedmieście", "Stare Miasto", "Podzamcze", "Nabrzeże Bystrzycy"]);
    expect(names("landmark")).toEqual(expect.arrayContaining(["Brama Krakowska", "Brama Grodzka", "Zamek w Lublinie", "Trybunał Koronny"]));
    expect(names("station")).toEqual(["Ⓜ Plac Litewski", "Ⓜ Brama Krakowska", "Ⓜ Plac Zamkowy", "Ⓜ Nabrzeże Bystrzycy"]);
    // Names never run upside down.
    for (const l of map.labels!) expect(l.angle > -Math.PI / 2 - 1e-9 && l.angle <= Math.PI / 2 + 1e-9, l.text).toBe(true);
    expect(map.places!.map((p) => p.name)).toEqual(names("district"));
    // The game's content stays on top: the clinic's walls, the market's deck and links.
    expect(map.blocks.length).toBeGreaterThan(10);
    expect(map.decks?.length).toBeGreaterThan(0);
  });

  it("keeps a name readable whichever way its street was drawn", () => {
    expect(readableAngle(0.3)).toBeCloseTo(0.3);
    expect(readableAngle(0.3 + Math.PI)).toBeCloseTo(0.3);
    expect(readableAngle(-Math.PI / 2)).toBeCloseTo(Math.PI / 2);
  });

  it("marks floors above the street, stairs, the lift and ladders (ADR-0021)", () => {
    // Heights from the ground under them: the market stands 20 m below Krakowskie (ADR-0045).
    const map = buildDistrictMap([...KANAL_PROPS, ...TARG_SOUTH_PROPS, ...TARG_NORTH_PROPS], (x, z) => ground(x, z).y);
    const kinds = (map.links ?? []).map((l) => l.kind);
    // The market's stairs (the covered footbridge over Grodzka has none, ADR-0045); one lift; three fire escape ladders.
    expect(kinds.filter((k) => k === "stairs")).toHaveLength(1);
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
    expect(a.mapMarkers.map((m) => m.kind)).toEqual(["fixer", "target", "target"]);
    const b = track([player, fixer, mori, courier, hired], [], contracts);
    expect(b.mapPlayer).toBe(a.mapPlayer);
    expect(b.mapMarkers).toBe(a.mapMarkers);
    const c = track([player, fixer, mori, courier, hired], ["killed:hebi_courier"], { active: null, completed: 1 });
    expect(c.mapMarkers.map((m) => m.kind)).toEqual(["fixer"]);
    expect(track([fixer], [], contracts).mapPlayer).toBeNull();
  });

  it("leaves the shops off the map: only fixers and accepted contracts (ADR-0035)", () => {
    const track = createMinimapTracker();
    const mori = { id: 3, key: "mori", position: { x: -6, y: 0, z: 2 }, interactable: { kind: "shop", dialogueId: "mori" } } as unknown as Entity;
    const oyaji = { id: 6, key: "oyaji", position: { x: 80, y: 0, z: 66 }, interactable: { kind: "shop", shopId: "oyaji", dialogueId: "oyaji" } } as unknown as Entity;
    expect(track([mori, oyaji], [], { active: null, completed: 0 }).mapMarkers).toEqual([]);
  });

  it("reaches the store through the session", () => {
    const { s, ui } = session();
    expect(ui.getState().map?.blocks.length).toBeGreaterThan(0);
    s.newGame();
    const st = ui.getState();
    // On the chair in the clinic (ADR-0038), on Krakowskie Przedmieście (ADR-0045).
    expect(st.mapPlayer).toMatchObject({ x: 319.5, z: -64.75 });
    // Kaito at the Neon Koi counter is the first step's target: his fixer dot gets the quest ring too.
    expect(st.mapMarkers.map((m) => m.kind).sort()).toEqual(["fixer", "quest", "target"]);
    expect(st.journal.quests[0]?.title).toBe("First job");
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
    const custom = { ...DEFAULT_SETTINGS, quality: "low", aimMode: "toggle", crouchMode: "hold", invertY: true, horizontalFov: 90, mouseSensitivity: 2, touchSensitivity: 0.5, volume: 0.3, bindings: { jump: ["KeyJ"] } } as const;
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
      sanitizeSettings({ quality: "ultra", aimMode: "sometimes", crouchMode: 3, mouseSensitivity: 99, touchSensitivity: "x", volume: -1, horizontalFov: 200, invertY: "yes", bindings: { jump: ["Space"], fire: "Mouse0", aim: [1] } }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      quality: "high",
      aimMode: "hold",
      mouseSensitivity: 3,
      touchSensitivity: 1,
      volume: 0,
      horizontalFov: 100,
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
    s.intents.changeSettings({ mouseSensitivity: 1.8 });
    expect(host.save).toHaveBeenLastCalledWith(expect.objectContaining({ mouseSensitivity: 1.8, quality: "low" }));
    expect(ui.getState().reloadNeeded).toBe(false);
    s.intents.changeSettings({ quality: "high" });
    expect(ui.getState().reloadNeeded).toBe(true);
    s.intents.changeSettings({ quality: "low" });
    expect(ui.getState().reloadNeeded).toBe(false);
    s.intents.changeSettings({ volume: 0.1 });
    expect(ui.getState().reloadNeeded).toBe(false);
    s.intents.reload();
    expect(host.reload).toHaveBeenCalled();
  });

  it("takes the field of view in horizontal degrees, clamped and saved, without a reload (ADR-0049)", () => {
    const host = { applied: DEFAULT_SETTINGS, save: vi.fn(), reload: vi.fn() };
    const { s, ui } = session(host);
    expect(ui.getState().settings.horizontalFov).toBe(80);
    s.intents.setFieldOfView(91.6);
    expect(host.save).toHaveBeenLastCalledWith(expect.objectContaining({ horizontalFov: 92 }));
    s.intents.setFieldOfView(140);
    expect(ui.getState().settings.horizontalFov).toBe(100);
    s.intents.setFieldOfView(10);
    expect(ui.getState().settings.horizontalFov).toBe(70);
    s.intents.setFieldOfView(Number.NaN);
    expect(ui.getState().settings.horizontalFov).toBe(70);
    expect(ui.getState().reloadNeeded).toBe(false);
  });

  it("sets the mix buses from the settings, with defaults for old entries and clamped values (ADR-0060)", () => {
    const old = sanitizeSettings({ quality: "low", volume: 0.3 });
    expect(old).toMatchObject({ volume: 0.3, musicVolume: DEFAULT_SETTINGS.musicVolume, sfxVolume: DEFAULT_SETTINGS.sfxVolume, ambienceVolume: DEFAULT_SETTINGS.ambienceVolume });
    expect(sanitizeSettings({ musicVolume: 3, sfxVolume: -1, ambienceVolume: "x" })).toMatchObject({ musicVolume: 1, sfxVolume: 0, ambienceVolume: DEFAULT_SETTINGS.ambienceVolume });
    const set: [string, number][] = [];
    applyVolumes({ setVolume: (bus: string, v: number) => set.push([bus, v]) }, { volume: 0.5, musicVolume: 0.2, sfxVolume: 0.7, ambienceVolume: 0.1 });
    expect(set).toEqual([["master", 0.5], ["music", 0.2], ["sfx", 0.7], ["ambience", 0.1]]);
  });

  it("keeps autosave on by default and for entries saved before it existed", () => {
    expect(DEFAULT_SETTINGS.autosave).toBe(true);
    expect(sanitizeSettings({ quality: "low" }).autosave).toBe(true);
    expect(sanitizeSettings({ autosave: "no" }).autosave).toBe(true);
    expect(sanitizeSettings({ autosave: false }).autosave).toBe(false);
  });

  it("keeps the language with the settings: English by default and for old entries, saved, no reload (ADR-0056)", () => {
    expect(DEFAULT_SETTINGS.locale).toBe("en");
    expect(sanitizeSettings({ quality: "low", volume: 0.3 }).locale).toBe("en");
    expect(sanitizeSettings({ locale: "de" }).locale).toBe("en");
    expect(sanitizeSettings({ locale: "pl" }).locale).toBe("pl");
    const st = memoryStorage();
    saveSettings(st, { ...DEFAULT_SETTINGS, locale: "pl" });
    expect(loadSettings(st).locale).toBe("pl");
    const host = { applied: DEFAULT_SETTINGS, save: vi.fn(), reload: vi.fn() };
    const { s, ui } = session(host);
    s.intents.changeSettings({ locale: "pl" });
    expect(ui.getState().settings.locale).toBe("pl");
    expect(host.save).toHaveBeenLastCalledWith(expect.objectContaining({ locale: "pl" }));
    expect(ui.getState().reloadNeeded).toBe(false);
  });

  it("reads the vertical field of view of entries saved before ADR-0049", () => {
    // The untouched old default (62 degrees tall, ~94 across 16:9) becomes the new default.
    expect(sanitizeSettings({ fov: 62 }).horizontalFov).toBe(80);
    // A chosen value keeps its width on 16:9, within the new range.
    expect(sanitizeSettings({ fov: 50 }).horizontalFov).toBe(79);
    expect(sanitizeSettings({ fov: 56 }).horizontalFov).toBe(87);
    expect(sanitizeSettings({ fov: 80 }).horizontalFov).toBe(100);
    // The new field wins over a stale old one.
    expect(sanitizeSettings({ fov: 50, horizontalFov: 95 }).horizontalFov).toBe(95);
    expect(sanitizeSettings({ fov: "wide" }).horizontalFov).toBe(80);
  });

  it("works without a settings host for the session only", () => {
    const { s, ui } = session();
    s.intents.changeSettings({ touchSensitivity: 2.5 });
    expect(ui.getState().settings.touchSensitivity).toBe(2.5);
    s.intents.reload();
  });
});
