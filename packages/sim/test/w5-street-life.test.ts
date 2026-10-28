import { describe, expect, it } from "vitest";
import { type Vec3, hm } from "@seki/core";
import {
  CONTRACT_SITE_SPAWNS,
  KANAL_SPOTS,
  SCHEDULES,
  STALL_KEEPERS,
  type ScheduleDef,
  Simulation,
  type StaticProp,
  WORLD_CHUNKS,
  WORLD_STASHES,
  YATAI_HOURS,
  chunkAt,
  scheduledPose,
  yataiOpen,
} from "../src";
import { byKey, collect, input, run, teleportPlayer } from "./helpers";

/**
 * ADR-0026: the people, stashes and the job that bring Ulica Kanałowa, the market stalls and
 * Shinsekai's dead ends to life. Geometry first (nothing new stands in anyone's way), then the
 * rules that use it: the daily plans, Fumiko's stall, the stashes.
 */

const at = (x: number, z: number): Vec3 => ({ x, y: 0, z });
const SOLIDS: readonly StaticProp[] = WORLD_CHUNKS.flatMap((c) => c.props).filter((p) => p.solid && p.view.kind === "block" && !p.mechanism);
/** A character's radius, with a little room to spare. */
const BODY = 0.4;

/** Solids a body standing on the floor at `p` would touch (stairs are walked on, not into). */
const blockers = (p: Vec3): StaticProp[] =>
  SOLIDS.filter((s) => {
    if (s.view.kind !== "block" || s.view.slope) return false;
    const { x: w, y: h, z: d } = s.view.size;
    const bottom = s.center.y - h / 2;
    const top = s.center.y + h / 2;
    // Underfoot (the floor it stands on) or overhead (a deck it walks under).
    if (top <= p.y + 0.3 || bottom >= p.y + 1.8) return false;
    return Math.abs(p.x - s.center.x) < w / 2 + BODY && Math.abs(p.z - s.center.z) < d / 2 + BODY;
  });

/** Points every 25 cm along the plan's paths, each walked from where the stop before left off. */
const planPoints = (def: ScheduleDef): Vec3[] => {
  const out: Vec3[] = [];
  def.stops.forEach((stop, i) => {
    const before = def.stops[(i - 1 + def.stops.length) % def.stops.length] ?? stop;
    const from = before.loop ? before.path[0] : (before.path.at(-1) ?? before.path[0]);
    const line = [from, ...stop.path];
    for (let k = 1; k < line.length; k++) {
      const a = line[k - 1] as Vec3;
      const b = line[k] as Vec3;
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25));
      for (let j = 0; j <= n; j++) out.push({ x: a.x + ((b.x - a.x) * j) / n, y: a.y + ((b.y - a.y) * j) / n, z: a.z + ((b.z - a.z) * j) / n });
    }
  });
  return out;
};

const plan = (key: string): ScheduleDef => {
  const def = SCHEDULES[key];
  if (!def) throw new Error(key);
  return def;
};

const skipTo = (sim: Simulation, minute: number) => {
  const now = Math.floor((sim.clock.seconds % 86400) / 60);
  const minutes = (minute - now + 1440) % 1440;
  if (minutes > 0) sim.enqueue({ type: "wait", minutes });
  sim.step();
};

const withEddies = (eddies: number): Simulation => {
  const snap = Simulation.create({ seed: 3 }).snapshot(null, "t", "");
  // No medical kit in the bag, so quick use has nothing to take.
  return Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, wallet: { eddies }, inventory: { ...snap.domain.inventory, stacks: {} } } });
};

describe("new places stand clear of every walk (ADR-0026)", () => {
  it.each(["hideo", "mei", "fumiko"])("%s's daily plan touches no solid", (key) => {
    const hits = planPoints(plan(key)).flatMap((p) => blockers(p).map((s) => `${p.x.toFixed(2)},${p.z.toFixed(2)} hits ${s.center.x},${s.center.z}`));
    expect(hits).toEqual([]);
  });

  it("each walk of a plan ends before its next stop begins", () => {
    for (const key of ["hideo", "mei", "fumiko"]) {
      const def = plan(key);
      def.stops.forEach((stop, i) => {
        const next = def.stops[(i + 1) % def.stops.length] ?? stop;
        const minutes = (next.at - stop.at + 1440) % 1440;
        // The pose stands at the stop, arrived, a minute before the next one starts.
        const pose = scheduledPose(def, { seconds: (stop.at + minutes - 1) * 60 });
        expect(pose.arrived, `${key} ${stop.label}`).toBe(true);
      });
    }
  });

  it("Kaito's spot under the footbridge, the stashes and the stall keepers are on open floor inside their chunk", () => {
    const spots = [...(CONTRACT_SITE_SPAWNS.kanal_bridge ?? []), ...WORLD_STASHES.map((s) => s.at), ...Object.values(KANAL_SPOTS), ...Object.values(STALL_KEEPERS)];
    for (const p of spots) {
      expect(chunkAt(p.x, p.z), `${p.x},${p.z}`).not.toBeNull();
      expect(blockers(p).map((s) => s.center), `${p.x},${p.z}`).toEqual([]);
    }
    expect(chunkAt(53.2, 78.2)?.id).toBe("kanal");
  });

  it("the road along Ulica Kanałowa stays open from the bend to the market gate", () => {
    for (const z of [78.5, 79, 79.5]) {
      const hits = [];
      for (let x = 8; x <= 66; x += 0.25) hits.push(...blockers(at(x, z)).map((s) => `${x},${z} hits ${s.center.x},${s.center.z}`));
      expect(hits).toEqual([]);
    }
  });

  it("the car wash keeps the car_wash site (the alley behind it) and Kaito's spot free", () => {
    for (const p of CONTRACT_SITE_SPAWNS.car_wash ?? []) expect(blockers(p)).toEqual([]);
    expect(blockers(at(6.2, 1.5))).toEqual([]);
  });
});

describe("daily plans on the street (ADR-0026)", () => {
  it("Hideo crosses the footbridge to the market gate in the morning", () => {
    const sim = Simulation.create({ seed: 1 });
    skipTo(sim, hm(7, 29));
    teleportPlayer(sim, at(40, 70));
    sim.step();
    const hideo = byKey(sim, "hideo")!;
    expect(Math.hypot(hideo.position.x - KANAL_SPOTS.hideoHome.x, hideo.position.z - KANAL_SPOTS.hideoHome.z)).toBeLessThan(0.1);
    let highest = 0;
    let worst = 0;
    for (let i = 0; i < 60 * 90; i++) {
      sim.step();
      highest = Math.max(highest, hideo.position.y);
      const pose = hideo.schedule!.pose!.position;
      worst = Math.max(worst, Math.hypot(hideo.position.x - pose.x, hideo.position.z - pose.z));
    }
    expect(highest).toBeGreaterThan(4.5);
    expect(worst).toBeLessThan(1.5);
    expect(Math.hypot(hideo.position.x - KANAL_SPOTS.hideoKiosk.x, hideo.position.z - KANAL_SPOTS.hideoKiosk.z)).toBeLessThan(0.2);
  }, 30_000);

  it("Mei sings under KARAOKE at night and waits by the bend by day", () => {
    const night = Simulation.create({ seed: 1 });
    teleportPlayer(night, at(20, 78));
    night.step();
    expect(byKey(night, "mei")!.position).toMatchObject({ x: KANAL_SPOTS.meiKaraoke.x, z: KANAL_SPOTS.meiKaraoke.z });
    const day = Simulation.create({ seed: 1 });
    skipTo(day, hm(12));
    teleportPlayer(day, at(20, 78));
    day.step();
    expect(byKey(day, "mei")!.position).toMatchObject({ x: KANAL_SPOTS.meiHome.x, z: KANAL_SPOTS.meiHome.z });
  });
});

describe("Fumiko's ramen stall (ADR-0026)", () => {
  it("is open from the afternoon to the small hours", () => {
    expect(yataiOpen({ seconds: YATAI_HOURS.open * 60 })).toBe(true);
    expect(yataiOpen({ seconds: 2 * 3600 })).toBe(true);
    expect(yataiOpen({ seconds: YATAI_HOURS.close * 60 })).toBe(false);
    expect(yataiOpen({ seconds: 12 * 3600 })).toBe(false);
  });

  it("opens its counter at night, sells ramen that heals from the bag", () => {
    const sim = withEddies(100);
    teleportPlayer(sim, at(STALL_KEEPERS.fumiko.x, 100.6), 0);
    sim.step();
    const started = collect<{ kind: string; shopId?: string; dialogueId: string }>(sim, "InteractionStarted");
    sim.step(input({ interact: true }));
    expect(started).toEqual([expect.objectContaining({ kind: "shop", shopId: "yatai", dialogueId: "fumiko" })]);
    sim.enqueue({ type: "buy-item", itemId: "ramen", shopId: "yatai" });
    sim.enqueue({ type: "end-dialogue" });
    sim.step();
    expect(sim.domain.inventory.stacks.ramen).toBe(1);
    expect(sim.domain.wallet.eddies).toBe(65);
    const player = sim.player()!;
    player.health = { ...player.health!, current: 40 };
    // Quick use leaves the food alone: it is for medical kit.
    sim.step(input({ useItem: true }));
    expect(player.health.current).toBe(40);
    sim.enqueue({ type: "use-item", ref: { stack: "ramen" } });
    sim.step();
    expect(player.health.current).toBe(70);
  });

  it("is closed by day: the prompt says so and the counter refuses to sell", () => {
    const sim = withEddies(100);
    skipTo(sim, hm(10));
    teleportPlayer(sim, at(STALL_KEEPERS.fumiko.x, 100.6), 0);
    run(sim, 60 * 10);
    const fumiko = byKey(sim, "fumiko")!;
    expect(fumiko.interactable?.dialogueId).toBe("fumiko_closed");
    const failed = collect<{ reason: string }>(sim, "PurchaseFailed");
    sim.enqueue({ type: "buy-item", itemId: "ramen", shopId: "yatai" });
    sim.step();
    expect(failed).toEqual([expect.objectContaining({ reason: "closed" })]);
    expect(sim.domain.wallet.eddies).toBe(100);
  });
});

describe("stashes in the dead ends (ADR-0026)", () => {
  it("are placed once Seki comes near, and searching one empties it for good", () => {
    const sim = Simulation.create({ seed: 1 });
    const keys = () => sim.domain.loot.containers.map((c) => c.key);
    expect(keys()).toEqual([]);
    const stash = WORLD_STASHES.find((s) => s.key === "stash:kanal-alley")!;
    teleportPlayer(sim, at(stash.at.x - 1, stash.at.z), Math.PI / 2);
    run(sim, 2);
    expect(keys()).toContain("stash:kanal-alley");
    const before = sim.domain.wallet.eddies;
    sim.enqueue({ type: "take-loot", containerKey: "stash:kanal-alley", line: "all" });
    sim.step();
    expect(sim.domain.wallet.eddies).toBe(before + 60);
    expect(sim.domain.inventory.stacks.yakitori).toBe(2);
    expect(keys()).not.toContain("stash:kanal-alley");
    teleportPlayer(sim, at(0, -28));
    run(sim, 2);
    teleportPlayer(sim, at(stash.at.x - 1, stash.at.z));
    run(sim, 2);
    expect(keys()).not.toContain("stash:kanal-alley");
  });
});
