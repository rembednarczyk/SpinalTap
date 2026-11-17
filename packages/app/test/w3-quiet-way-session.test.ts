import { describe, expect, it } from "vitest";
import { type Contract, W3_VIRUS_ITEM, contractAlarmFlag, lockerKey } from "@seki/core";
import { GENZO_SPOT, SIM_HZ, W3_LAYOUT, W3_LOCKER_14, W3_MANAGER_WINDOW, W3_NAV, W3_PATROL_MANAGER, W3_SMOKER, W3_TECHNICIANS, W3_Y, routeLapSeconds, routePose } from "@seki/sim";
import { translate } from "@seki/ui";
import { contentText } from "../src/content-text";
import { allText, frame, setup, steps, teleport } from "./story-helpers";
import type { GameSession } from "../src/game-session";

/**
 * W-3's quiet way through the culvert and the hall (ADR-0082 §1, G-907), headless: Genzō hands over
 * the pendrive and tells the two ways in, the culvert's mouth offers the crawl, locker 14 at its
 * top holds a technician's overalls, and in them the hall lets Seki cross to corridor N: neither
 * the patrol nor a technician gives her away while her gun is away and she walks.
 */

type Ui = ReturnType<typeof setup>["ui"];

const start = () => {
  const s = setup();
  s.session.newGame();
  steps(s.session, 2);
  return s;
};

const acceptSabotage = (session: GameSession, u: Ui): Contract => {
  teleport(session, GENZO_SPOT.x + 0.3, GENZO_SPOT.z - 1.8, 0);
  steps(session, 1);
  steps(session, 1, frame({ interact: true }));
  const choice = (u.getState().dialogue?.choices ?? []).find((c) => c.text.startsWith("Co to za partia dronów"));
  if (!choice) throw new Error("no sabotage offer");
  session.intents.choose(choice.index);
  const said = allText(u);
  session.intents.closeDialogue();
  steps(session, 2);
  const job = session.sim.domain.contracts.active;
  if (job?.kind !== "sabotage") throw new Error("no sabotage");
  expect(said).toContain("Wylot kolektora pod nabrzeżem");
  return job;
};

/** The gun away (Seki starts with it in hand). */
const holster = (session: GameSession) => {
  steps(session, 1, frame({ toggleWeapon: true }));
  steps(session, 30);
  expect(session.sim.player()!.combatant?.holstered).toBe(true);
};

/** Opens locker 14 standing by it, takes the overalls and puts them on. */
const changeAtLocker = (session: GameSession, u: Ui) => {
  steps(session, 1, frame({ interact: true }));
  expect(u.getState().loot?.key).toBe(lockerKey(session.sim.domain.contracts.active!.id));
  session.intents.takeLoot("all");
  steps(session, 1);
  const overalls = session.sim.domain.inventory.items.find((i) => i.def === "tessen_overalls")!;
  session.intents.openCharacterScreen("inventory");
  session.intents.equip(overalls.uid);
  session.intents.closeCharacterScreen();
  steps(session, 1);
  expect(session.sim.domain.disguise).toEqual({ role: "tessen_staff", blown: false });
};

const node = (id: string) => W3_NAV.nodes.find((n) => n.id === id)!.at;

/** Walks to each point in turn, turning towards it, until within half a metre (or fails the step). */
const walkTo = (session: GameSession, points: readonly { x: number; z: number }[], input = frame({ moveZ: 1 })) => {
  for (const goal of points) {
    for (let i = 0; i < 60 * 30; i++) {
      const p = session.sim.player()!;
      const [dx, dz] = [goal.x - p.position.x, goal.z - p.position.z];
      if (Math.hypot(dx, dz) < 0.5) break;
      p.yaw = Math.atan2(dx, dz);
      session.step(input);
    }
    const p = session.sim.player()!.position;
    expect(Math.hypot(goal.x - p.x, goal.z - p.z), `${goal.x},${goal.z}`).toBeLessThan(0.6);
  }
};

/** Seconds until the job's alarm goes up, holding still (crouched or not) for at most `seconds`; null: it never did. */
const alarmWithin = (session: GameSession, job: Contract, seconds: number, input = frame()): number | null => {
  const alarm = contractAlarmFlag(job.id);
  for (let i = 0; i < seconds * SIM_HZ; i++) {
    session.step(input);
    if (session.sim.domain.flags.includes(alarm)) return i / SIM_HZ;
  }
  return null;
};

const C = W3_LAYOUT.CULVERT_Z;
const MOUTH = { x: W3_LAYOUT.CULVERT_CRAWL.minX - 1.2, z: (C.minZ + C.maxZ) / 2 };

describe("W-3's quiet way through the culvert and the hall (ADR-0082 §1, G-907)", () => {
  it("Genzō hands over the pendrive with the job and tells the culvert and the pipes, into the tracker", () => {
    const { session, ui } = start();
    expect(session.sim.domain.inventory.keyItems).toEqual([]);
    const job = acceptSabotage(session, ui);
    expect(session.sim.domain.inventory.keyItems).toEqual([W3_VIRUS_ITEM]);
    expect(session.sim.domain.contracts.hooks).toEqual(["hook_sabotage_culvert", "hook_sabotage_pipes"]);
    const locale = ui.getState().settings.locale;
    expect(ui.getState().contractHooks.map((h) => h.text)).toEqual([contentText(locale, "hook.sabotage_culvert"), contentText(locale, "hook.sabotage_pipes")]);
    // Locker 14 at the culvert's top holds the overalls for as long as the job runs.
    const locker = session.sim.domain.loot.containers.find((c) => c.key === lockerKey(job.id));
    expect(locker?.position).toEqual(W3_LOCKER_14);
    expect(locker?.lines).toMatchObject([{ kind: "item", item: "tessen_overalls", qty: 1 }]);
  });

  it("the culvert's mouth offers the crawl: the key takes her in crouched, and she crawls on to the basement", () => {
    const { session, ui } = start();
    teleport(session, MOUTH.x, MOUTH.z, Math.PI / 2, 0, W3_Y + W3_LAYOUT.CULVERT_MOUTH.floor);
    steps(session, 2);
    const locale = ui.getState().settings.locale;
    expect(ui.getState().prompt).toBe(contentText(locale, "prompt.culvert"));
    steps(session, 1, frame({ interact: true }));
    expect(session.sim.player()!.posture?.crouched).toBe(true);
    // Under the culvert's ceiling she stays down without the crouch key, out at its top she stands.
    walkTo(session, [{ x: 2500, z: MOUTH.z }]);
    expect(session.sim.player()!.posture?.crouched).toBe(true);
    walkTo(session, [{ x: 2518, z: MOUTH.z }]);
    steps(session, 30);
    expect(session.sim.player()!.position.y).toBeCloseTo(W3_Y + W3_LAYOUT.BASEMENT_FLOOR, 1);
    expect(session.sim.player()!.posture?.crouched).toBe(false);
    expect(translate(locale, "prompt.culvert")).not.toBe("prompt.culvert");
  });

  it("the crawl is offered in the mouth only, not from the tops of its wing walls 1.35 m above (G-930)", () => {
    const { session, ui } = start();
    const locale = ui.getState().settings.locale;
    for (const z of [406, 408.4]) {
      teleport(session, MOUTH.x, z, Math.PI / 2, 0, W3_Y - 0.1);
      steps(session, 2);
      // She stands up there, by the mouth's entry point, 1.35 m over its floor.
      expect(session.sim.player()!.position.y - (W3_Y + W3_LAYOUT.CULVERT_MOUTH.floor), `z ${z}`).toBeGreaterThan(1.2);
      expect(ui.getState().prompt, `z ${z}`).not.toBe(contentText(locale, "prompt.culvert"));
    }
  });

  it("in the overalls a technician lets her be, without them it reports her; a gun in hand gives her away", () => {
    for (const [overalls, gun, reported] of [
      [false, false, true],
      [true, false, false],
      [true, true, true],
    ] as const) {
      const { session, ui } = start();
      const job = acceptSabotage(session, ui);
      // Only the technicians watch: the guards are taken out of the hall.
      for (const g of [...session.sim.world.with("ai")]) if (g.key?.startsWith(`${job.id}-g`)) session.sim.world.remove(g);
      teleport(session, W3_LOCKER_14.x, W3_LOCKER_14.z - 1, Math.PI, 0, W3_LOCKER_14.y);
      steps(session, 2);
      if (overalls) changeAtLocker(session, ui);
      if (!gun) holster(session);
      // In front of the technician at S2, on the far side of belt L1, in its view.
      const t = W3_TECHNICIANS[0]!;
      teleport(session, t.at.x, t.at.z - 5, 0, 0, t.at.y);
      expect(alarmWithin(session, job, 10) !== null, `overalls ${overalls}, gun ${gun}`).toBe(reported);
    }
  });

  it("in the overalls the hall's patrol walks past her in the aisle (2529; 418) for 15 s; without them it raises the alarm", () => {
    for (const overalls of [false, true]) {
      const { session, ui } = start();
      const job = acceptSabotage(session, ui);
      teleport(session, W3_LOCKER_14.x, W3_LOCKER_14.z - 1, Math.PI, 0, W3_LOCKER_14.y);
      steps(session, 2);
      if (overalls) changeAtLocker(session, ui);
      holster(session);
      const aisle = node("w3-aisle-mid");
      teleport(session, aisle.x, aisle.z, Math.PI / 2, 0, aisle.y);
      // P1, the job's first post, walks the aisle: track how near it comes.
      const p1 = [...session.sim.world.with("ai")].find((g) => g.key === `${job.id}-g0`)!;
      let nearest = Infinity;
      const alarm = contractAlarmFlag(job.id);
      let at: number | null = null;
      for (let i = 0; i < 15 * SIM_HZ && at === null; i++) {
        session.step(frame({ crouch: true }));
        const p = session.sim.player()!.position;
        nearest = Math.min(nearest, Math.hypot(p1.position.x - p.x, p1.position.z - p.z));
        if (session.sim.domain.flags.includes(alarm)) at = i / SIM_HZ;
      }
      if (overalls) {
        expect(at).toBeNull();
        expect(nearest).toBeLessThan(4);
        expect(p1.view?.kind === "enemy" && p1.view.enforcer).toBeFalsy();
        expect(session.sim.domain.disguise).toEqual({ role: "tessen_staff", blown: false });
      } else expect(at).not.toBeNull();
    }
  });

  // The walk from the parts line's door to corridor N takes 18 s. Set off 6.5-11 s into the shift
  // manager's lap, it passes under his window in his halt there (16-21 s) and he knows her (G-929).
  it.each([
    ["once the shift manager has left his window", AWAY_FROM_WINDOW, 0, false],
    ["timed into his halt at the window", 0, 8.5, true],
  ] as const)("crawls the culvert, changes at locker 14 and crosses the hall to corridor N: %s", (_when, stop, wait, seen) => {
    const { session, ui } = start();
    const job = acceptSabotage(session, ui);
    holster(session);
    teleport(session, MOUTH.x, MOUTH.z, Math.PI / 2, 0, W3_Y + W3_LAYOUT.CULVERT_MOUTH.floor);
    steps(session, 2);
    steps(session, 1, frame({ interact: true }));
    walkTo(session, [{ x: 2518, z: MOUTH.z }, { x: W3_LOCKER_14.x, z: W3_LOCKER_14.z - 0.6 }]);
    changeAtLocker(session, ui);
    const route = ["w3-cellar-mid", "w3-cellar-w", "w3-cellar-a", "w3-stair-a-top", "w3-parts-line-door"];
    // The cellar and stair A walked once (the first case); timed into his halt she starts at the door (ADR-0083).
    if (seen) {
      const door = node("w3-parts-line-door");
      teleport(session, door.x, door.z, 0, 0, door.y);
      steps(session, 2);
    } else walkTo(session, route.map(node));
    waitForManager(session, job, stop);
    steps(session, wait * SIM_HZ);
    const blownBy: number[] = [];
    session.bus.on("DisguiseBlown", (e) => blownBy.push(e.observerId));
    const hall = [`w3-cs-${W3_LAYOUT.DOORS_S.line}`, `w3-cs-${W3_LAYOUT.HALL_DOORS[0]}`, "w3-hall-sw", "w3-aisle-w", "w3-aisle-mid", "w3-aisle-e"];
    walkTo(session, hall.map(node));
    const manager = managerOf(session, job);
    // Timed into his halt she is known by the aisle's east end; the rest of the way is not walked.
    if (!seen) {
      walkTo(session, ["w3-hall-ne", `w3-cn-${W3_LAYOUT.HALL_DOORS[1]}`].map(node));
      expect(session.sim.player()!.position.z).toBeGreaterThan(430);
    }
    if (seen) {
      expect(blownBy).toEqual([manager.id]);
      expect(session.sim.domain.disguise).toEqual({ role: "tessen_staff", blown: true });
      expect(session.sim.domain.flags).toContain(contractAlarmFlag(job.id));
      return;
    }
    expect(alarmWithin(session, job, 5)).toBeNull();
    expect(session.sim.domain.disguise).toEqual({ role: "tessen_staff", blown: false });
    // The shift manager was on the mezzanine all the while and never saw her.
    expect(manager.ai?.suspicion ?? 0).toBe(0);
  });
});

/** The job's shift manager on the mezzanine (G-929). */
const managerOf = (session: GameSession, job: Contract) => {
  const m = [...session.sim.world.with("ai")].find((g) => g.key === `${job.id}-manager`);
  if (!m) throw new Error("no shift manager");
  return m;
};

/** In the overalls with the gun away at locker 14, the job taken. */
const disguised = () => {
  const { session, ui } = start();
  const job = acceptSabotage(session, ui);
  teleport(session, W3_LOCKER_14.x, W3_LOCKER_14.z - 1, Math.PI, 0, W3_LOCKER_14.y);
  steps(session, 2);
  changeAtLocker(session, ui);
  holster(session);
  return { session, job };
};

/**
 * Seconds until the disguise is blown, standing still for at most `seconds`, and who blew it;
 * null: it held. `each` looks at the world after every step.
 */
const blownWithin = (session: GameSession, seconds: number, each = () => {}): { at: number; by: number } | null => {
  const seen: number[] = [];
  const off = session.bus.on("DisguiseBlown", (e) => seen.push(e.observerId));
  try {
    for (let i = 0; i < seconds * SIM_HZ; i++) {
      session.step(frame());
      each();
      if (seen.length > 0) return { at: i / SIM_HZ, by: seen[0]! };
    }
    return null;
  } finally {
    off();
  }
};

/** One lap of the manager's round: 29.8 m at 1.4 m/s and six halts of 4 s, 45 s. */
const MANAGER_LAP = Math.ceil(routeLapSeconds(W3_PATROL_MANAGER));
/** His round's stops: walking to the window (1), then back on the gallery after the step back from it (4). */
const TO_WINDOW = 1;
const AWAY_FROM_WINDOW = 4;

/** Steps standing still till the manager's round is at `stop` (its halt or the walk after it). */
const waitForManager = (session: GameSession, job: Contract, stop: number) => {
  const route = managerOf(session, job).ai!.route!;
  for (let i = 0; i < MANAGER_LAP * SIM_HZ && routePose(route, session.sim.tick / SIM_HZ).stop !== stop; i++) session.step(frame());
  expect(routePose(route, session.sim.tick / SIM_HZ).stop).toBe(stop);
};
/** On the gallery between his office's door and its east end, a metre off his way and P2's. */
const GALLERY = { x: 2536, y: W3_Y + W3_LAYOUT.MEZZANINE, z: 434.1 };
/** In the aisle's south half under his window, 14 m off it: in his sight from the window only. */
const UNDER_WINDOW = { x: W3_MANAGER_WINDOW.x, y: W3_Y, z: 417 };

describe("W-3's shift manager on the mezzanine, the hall's enforcer of disguises (ADR-0082 §1 p. 2, G-929)", () => {
  it("sees through the overalls up close on the gallery; without him P2 walks past her there and they hold", () => {
    for (const manager of [true, false]) {
      const { session, job } = disguised();
      const m = managerOf(session, job);
      if (!manager) session.sim.world.remove(m);
      const p2 = [...session.sim.world.with("ai")].find((g) => g.key === `${job.id}-g1`)!;
      teleport(session, GALLERY.x, GALLERY.z, Math.PI / 2, 0, GALLERY.y);
      let p2Nearest = Infinity;
      // When and from how far the manager first doubts her.
      let noticed: { tick: number; distance: number } | null = null;
      const blown = blownWithin(session, MANAGER_LAP, () => {
        const p = session.sim.player()!.position;
        p2Nearest = Math.min(p2Nearest, Math.hypot(p2.position.x - p.x, p2.position.z - p.z));
        if (!noticed && (m.ai?.suspicion ?? 0) > 0) noticed = { tick: session.sim.tick, distance: Math.hypot(m.position.x - p.x, m.position.z - p.z) };
      });
      if (manager) {
        // Out of his office's door onto the gallery he sees her 6.1 m off and knows her in 2.2 s.
        expect(blown?.by).toBe(m.id);
        const seen = noticed as { tick: number; distance: number } | null;
        expect(seen!.distance).toBeLessThan(8);
        expect((session.sim.tick - seen!.tick) / SIM_HZ).toBeLessThan(3);
        expect(m.view?.kind === "enemy" && m.view.enforcer).toBe(true);
      } else {
        expect(p2Nearest).toBeLessThan(2);
        expect(blown).toBeNull();
        expect(session.sim.domain.disguise).toEqual({ role: "tessen_staff", blown: false });
      }
    }
  });

  it("from his window's halt he knows her standing under it in the aisle, and the job's alarm goes up", () => {
    const { session, job } = disguised();
    const m = managerOf(session, job);
    waitForManager(session, job, TO_WINDOW);
    teleport(session, UNDER_WINDOW.x, UNDER_WINDOW.z, 0, 0, UNDER_WINDOW.y);
    const blown = blownWithin(session, MANAGER_LAP);
    expect(blown?.by).toBe(m.id);
    // At the window or the step back from it, up on the mezzanine, 13-14 m off her.
    expect(m.position.z).toBeLessThan(W3_MANAGER_WINDOW.look + 0.3);
    expect(m.position.y).toBeCloseTo(GALLERY.y, 1);
    expect(Math.hypot(m.position.x - UNDER_WINDOW.x, m.position.z - UNDER_WINDOW.z)).toBeGreaterThan(12);
    expect(alarmWithin(session, job, 3)).not.toBeNull();
  });

  it("a lead in the hall below does not take him down: Tessen sent to (2522; 416), he is back on his round, and the aisle holds", () => {
    const { session, job } = disguised();
    const m = managerOf(session, job);
    // As the security sent to a reported body (`sendSecurity`): every calm Tessen within 50 m gets the lead.
    const lead = { x: 2522, y: W3_Y, z: 416 };
    for (const g of session.sim.world.with("ai")) {
      if (g.faction === "tessen" && !g.ai.alerted && Math.hypot(g.position.x - lead.x, g.position.z - lead.z) <= 50) Object.assign(g.ai, { lastKnown: { ...lead }, search: 0 });
    }
    // Stepped until he is back on his round with no lead (at most 60 s; the look round is 6 s).
    const offRound = () => {
      const pose = routePose(m.ai!.route!, session.sim.tick / SIM_HZ).position;
      return Math.hypot(m.position.x - pose.x, m.position.z - pose.z);
    };
    let lowest = Infinity;
    for (let i = 0; i < 60 * SIM_HZ && (i < SIM_HZ || m.ai?.lastKnown || offRound() >= 1.5); i++) {
      session.step(frame());
      lowest = Math.min(lowest, m.position.y);
    }
    expect(lowest).toBeCloseTo(GALLERY.y, 1);
    expect(m.ai?.lastKnown ?? null).toBeNull();
    expect(offRound()).toBeLessThan(1.5);
    // Off his window's halt she stands in the aisle by the lead's spot as long as she likes.
    waitForManager(session, job, AWAY_FROM_WINDOW);
    const aisle = node("w3-aisle-mid");
    teleport(session, aisle.x, aisle.z, 0, 0, aisle.y);
    expect(blownWithin(session, 20)).toBeNull();
    expect(alarmWithin(session, job, 1)).toBeNull();
  });

  it("from anywhere else on his round he never sees her on the hall's floor: a whole lap in the aisle's north half and under the gallery", () => {
    const { session, job } = disguised();
    const m = managerOf(session, job);
    for (const at of [{ ...UNDER_WINDOW, z: 422 }, node("w3-hall-ne")]) {
      teleport(session, at.x, at.z, 0, 0, at.y);
      let suspicion = 0;
      for (let i = 0; i < MANAGER_LAP * SIM_HZ; i++) {
        session.step(frame());
        suspicion = Math.max(suspicion, m.ai?.suspicion ?? 0);
      }
      expect(suspicion, `${at.x},${at.z}`).toBe(0);
    }
    expect(m.position.y).toBeCloseTo(GALLERY.y, 1);
    expect(session.sim.domain.disguise).toEqual({ role: "tessen_staff", blown: false });
  });
});

describe("W-3's smoker by the service gate (ADR-0082 §1 p. 2, G-929)", () => {
  it("in his evening hours he tells of locker 14 within earshot, into the tracker, and says it as a subtitle", () => {
    const { session, ui } = start();
    const job = acceptSabotage(session, ui);
    const hour = Math.floor(session.sim.domain.clock.seconds / 3600) % 24;
    expect(hour >= W3_SMOKER.fromHour && hour < W3_SMOKER.toHour, `${hour}:00`).toBe(true);
    // On the strip 8 m west of him: he is there, out of earshot.
    const s = W3_SMOKER.at;
    teleport(session, s.x - 8, s.z, Math.PI / 2, 0, s.y);
    steps(session, 2);
    expect([...session.sim.world].find((e) => e.key === `${job.id}-smoker`)?.position).toEqual(s);
    expect(session.sim.domain.contracts.hooks).not.toContain("hook_sabotage_2");
    // Outside the service gate, 2.4 m off him.
    walkTo(session, [node("w3-wicket-out")]);
    steps(session, 1);
    expect(session.sim.domain.contracts.hooks).toContain("hook_sabotage_2");
    const locale = ui.getState().settings.locale;
    expect(ui.getState().contractHooks.map((h) => h.text)).toContain(contentText(locale, "hook.sabotage_2"));
    const said = ui.getState().toasts.find((t) => t.title === contentText(locale, "speaker.technik"));
    expect(said?.text).toMatch(/szafkę czternaście|locker fourteen/);
  });
});
