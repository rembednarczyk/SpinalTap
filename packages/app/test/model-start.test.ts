import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type AudioPort, type EntityId, KAGAMI_JOB_FLAG, type RenderPort, type ViewDescriptor } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { KUROSAWA_SPOT } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { type CharacterDescriptor, donorFiles, manifestFiles, modelChoiceOf, startFiles } from "@seki/engine";
import { GameSession } from "../src/game-session";
import { parseModelManifest } from "../src/model-manifest";
import { steps, teleport } from "./story-helpers";

/**
 * What the loading screen waits for (ADR-0076 stage 4a, G-547), headless: the scene a new game or
 * a load spawns, run through the renderer's choice of start files with the game's manifest. The
 * fake renderer "downloads" them at a fixed rate, so the first frame comes after their bytes.
 */

const BASE = "https://example.test/game/models/manifest.json";
const read = readFileSync as (u: URL) => Uint8Array;
const fileOf = (name: string) => new URL(`../public/models/${name}`, import.meta.url);
const GAME = parseModelManifest(JSON.parse(new TextDecoder().decode(read(fileOf("manifest.json")))), BASE);
const nameOf = (url: string) => url.slice(url.lastIndexOf("/") + 1);
const bytesOf = (urls: readonly string[]) => urls.reduce((n, u) => n + (statSync as (u: URL) => { size: number })(fileOf(nameOf(u))).size, 0);
const MIB = 1024 * 1024;
/** A 50 Mbit/s line, for the first frame's wait. */
const BYTES_PER_MS = 50e6 / 8 / 1000;

const isCharacter = (v: ViewDescriptor): v is CharacterDescriptor => v.kind === "heroine" || v.kind === "npc" || v.kind === "enemy";

/** A renderer that keeps the views and, behind the loading screen, fetches the start's files. */
class ModelRender implements RenderPort {
  readonly views = new Map<EntityId, ViewDescriptor>();
  /** The files of each start, by name, and the time to the first frame. */
  readonly starts: { files: string[]; ms: number }[] = [];
  /** Files the background brings in after a start, until the next one asks. */
  background: string[] = [];
  spawn(id: EntityId, view: ViewDescriptor) {
    this.views.set(id, view);
  }
  updateTransform() {}
  despawn(id: EntityId) {
    this.views.delete(id);
  }
  clear() {
    this.views.clear();
  }
  setCameraMode() {}
  attachCamera() {}
  playEffect() {}
  setAppearance() {}
  prepare(): Promise<void> {
    const files = startFiles(GAME, [...this.views.values()].filter(isCharacter).map(modelChoiceOf)).map((s) => s.url);
    this.starts.push({ files: files.map(nameOf).sort(), ms: bytesOf(files) / BYTES_PER_MS });
    this.background = donorFiles(GAME).map((s) => nameOf(s.url)).filter((n) => !files.some((f) => nameOf(f) === n));
    return Promise.resolve();
  }
}

const silent: AudioPort = { play() {}, stopAll() {} };
const settle = () => new Promise((r) => setTimeout(r, 0));

const setup = () => {
  const render = new ModelRender();
  const session = new GameSession({ render, audio: silent, persistence: new SavePersistence(new MemorySaveStore()), ui: createUiStore(), story: STORY_SOURCE, seed: () => 2024, now: () => new Date(2026, 9, 31, 20, 0) });
  return { render, session };
};

describe("the models a start loads (ADR-0076 stage 4a)", () => {
  it("waits for the files of Neon Koi's scene and its donors on a new game, not kurosawa.vrm (G-547, G-560)", async () => {
    const { render, session } = setup();
    session.newGame();
    await settle();
    expect(session.screen).toBe("playing");
    const [start] = render.starts;
    // The gangers' looks may borrow cloth, so the donors' files (mori.vrm for the pools) come too.
    expect(start!.files).toEqual(["base-female.vrm", "civilian.vrm", "ganger.vrm", "kaito.vrm", "mori.vrm", "seki.vrm"]);
    expect(start!.files).not.toContain("kurosawa.vrm");
    const all = manifestFiles(GAME).map((s) => nameOf(s.url));
    // Before: every file of the manifest (42.5 MiB); now all but Kurosawa's (36.5 MiB).
    expect(bytesOf(start!.files)).toBe(bytesOf(all) - bytesOf(["kurosawa.vrm"]));
    expect(bytesOf(all) / MIB).toBeGreaterThan(42);
    // Kurosawa's file, only a named one wears, neither comes with the start nor in the background.
    expect(render.background).toEqual([]);
  });

  it("waits for Kurosawa's file when a save loads by him, and saves and loads in the second act", async () => {
    const { render, session } = setup();
    session.newGame();
    await settle();
    // Act II: the Kagami job is open and Kurosawa waits behind Alchemia (alchemia/market.ts).
    session.sim.enqueue({ type: "set-flag", flag: KAGAMI_JOB_FLAG });
    teleport(session, KUROSAWA_SPOT.x + 1.5, KUROSAWA_SPOT.z, Math.PI / 2, 0, KUROSAWA_SPOT.y);
    steps(session, 2);
    expect([...render.views.values()].some((v) => v.kind === "npc" && v.cast === "kurosawa")).toBe(true);
    expect(await session.saves.saveAsync("act2")).toBe(true);
    const saved = session.saves.snapshot();
    expect(await session.saves.loadAsync("act2")).toBe(true);
    await settle();
    expect(session.screen).toBe("playing");
    expect(render.starts).toHaveLength(2);
    expect(render.starts[1]!.files).toContain("kurosawa.vrm");
    expect(session.saves.snapshot().domain).toEqual(saved.domain);
  });
});
