import { describe, expect, it } from "vitest";
import {
  type AudioPort,
  type CameraMode,
  EMPTY_INPUT,
  type EffectDescriptor,
  HACK_SECONDS,
  type InputFrame,
  type RenderPort,
  contractTag,
} from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { MemorySaveStore, SavePersistence } from "@seki/persistence";
import { DOKI_ITEM_SPOTS, DOKI_TERMINAL_SPOTS, GENZO_SPOT, SIM_HZ, ground } from "@seki/sim";
import { createUiStore } from "@seki/ui";
import { GameSession } from "../src/game-session";

/** What the debrief card pays on top of the reward (ADR-0029); subscribe right before the payment. */
const extraPay = (session: GameSession): (() => number) => {
  let extra = 0;
  session.sim.bus.on("ContractDebrief", (c) => {
    extra += c.bonus + c.styleBonus;
  });
  return () => extra;
};

const effects: EffectDescriptor[] = [];
const render: RenderPort = {
  spawn() {},
  updateTransform() {},
  despawn() {},
  clear() {},
  setCameraMode(_m: CameraMode) {},
  attachCamera() {},
  playEffect(e: EffectDescriptor) {
    effects.push(e);
  },
  setAppearance() {},
};
const audio: AudioPort = { play() {}, stopAll() {} };

const frame = (p: Partial<InputFrame> = {}): InputFrame => ({ ...EMPTY_INPUT, ...p });

type Ui = ReturnType<typeof createUiStore>;

/** After M0 and one paid contract for Kaito: free work, the docks open. */
const setup = async () => {
  const ui = createUiStore();
  const persistence = new SavePersistence(new MemorySaveStore());
  const session = new GameSession({ render, audio, persistence, ui, story: STORY_SOURCE, seed: () => 43, now: () => new Date(2026, 9, 27) });
  session.newGame();
  const snap = session.snapshot();
  await persistence.save("start", {
    ...snap,
    domain: {
      ...snap.domain,
      character: { ...snap.domain.character, alias: "Seki Senshi", memories: ["combat_reflex"] },
      quests: { m0_first_contract: { status: "completed" } },
      flags: ["dead:courier", "dead:guard", "killed:hebi_courier", "met_fixer", "reported_back"],
      contracts: { active: null, completed: 1 },
      wallet: { eddies: 400 },
    },
  });
  await session.loadAsync("start");
  return { session, ui };
};

const teleport = (s: GameSession, x: number, z: number, yaw = 0, y?: number) => {
  const p = s.sim.player()!;
  p.position = { x, y: y ?? ground(x, z).y, z };
  p.prevPosition = p.position;
  p.yaw = yaw;
  p.pitch = 0;
};

const steps = (s: GameSession, n: number, input: InputFrame = EMPTY_INPUT) => {
  for (let i = 0; i < n; i++) s.step(input);
  s.render(0);
};

const text = (ui: Ui) => (ui.getState().dialogue?.lines ?? []).map((l) => l.text).join("\n");
const toasts = (ui: Ui) => ui.getState().toasts.map((t) => `${t.title}: ${t.text}`);

const choose = (s: GameSession, ui: Ui, option: string) => {
  const index = ui.getState().dialogue?.choices.find((c) => c.text === option)?.index;
  if (index === undefined) throw new Error(`no option "${option}" in ${JSON.stringify(ui.getState().dialogue?.choices)}`);
  s.intents.choose(index);
};

const close = (s: GameSession) => {
  s.intents.closeDialogue();
  steps(s, 1);
};

/** In front of Genzō; arriving streams the docks in during the same step. */
const talkToGenzo = (s: GameSession) => {
  teleport(s, GENZO_SPOT.x + 0.3, GENZO_SPOT.z - 1.8, 0);
  steps(s, 1, frame({ interact: true }));
};

/** The wave is fought in the sim tests; here it only has to be out of the way. */
const downTheWave = (s: GameSession) => {
  const tag = contractTag(s.sim.domain.contracts.active!.id);
  for (const e of s.sim.world) if (e.tag === tag && e.health) e.health = { current: 0, max: e.health.max };
  steps(s, 1);
};

describe("M4 acceptance: the docks", () => {
  it("Genzō's hack through the dialogue, the HUD and a save in the middle; then an infiltration", async () => {
    const { session, ui } = await setup();
    const eddies = () => session.sim.domain.wallet.eddies;

    talkToGenzo(session);
    expect(ui.getState().dialogue?.lines[0]?.speaker).toBe("Genzō");
    expect(text(ui)).toContain("Pływam nocą");
    choose(session, ui, "Który terminal mam złamać?");
    expect(text(ui)).toContain("Czerwony laser");
    close(session);
    const hack = session.sim.domain.contracts.active!;
    expect(hack.kind).toBe("hack");
    expect(ui.getState().questTitle).toBe("Kontrakt 2 · Genzō");
    expect(ui.getState().objective).toContain("Włam się do terminala");
    expect(toasts(ui).some((t) => t.startsWith("Nowy kontrakt: Włamanie do terminala"))).toBe(true);
    // The terminal is on the minimap.
    expect(ui.getState().mapMarkers.some((m) => m.id === `${hack.id}-terminal` && m.kind === "target")).toBe(true);

    const t = DOKI_TERMINAL_SPOTS.quay_terminal!;
    teleport(session, t.x, t.z - 1.4, 0);
    steps(session, 1, frame({ interact: true }));
    expect(toasts(ui)).toContain("Alarm na Nabrzeżu: Utrzymaj terminal, ochrona już idzie");
    downTheWave(session);
    steps(session, 10 * SIM_HZ);
    expect(ui.getState().objective).toMatch(/Utrzymaj połączenie z terminalem \(zostało 0:\d\d\)/);

    expect(await session.saveAsync("quick")).toBe(true);
    const progress = session.sim.domain.contracts.active!.progress!;
    steps(session, 5 * SIM_HZ);
    expect(await session.loadAsync("quick")).toBe(true);
    expect(session.sim.domain.contracts.active!.progress).toBe(progress);
    teleport(session, t.x, t.z - 1.4, 0);
    steps(session, HACK_SECONDS * SIM_HZ - progress + 2);
    expect(ui.getState().objective).toBe("Terminal złamany. Wróć do Genzō po zapłatę");

    const before = eddies();
    const extra = extraPay(session);
    talkToGenzo(session);
    expect(text(ui)).toContain("Terminal złamany");
    expect(text(ui)).toContain(`${hack.reward} eddies`);
    steps(session, 1);
    expect(eddies()).toBe(before + hack.reward + extra());

    // Straight on: the office.
    choose(session, ui, "Co trzeba wynieść z biura Tessen?");
    close(session);
    const job = session.sim.domain.contracts.active!;
    expect(job.kind).toBe("infiltrate");
    const desk = DOKI_ITEM_SPOTS.tessen_office!;
    teleport(session, desk.x + 1.1, desk.z, -Math.PI / 2);
    steps(session, 1, frame({ interact: true, crouch: true }));
    expect(ui.getState().objective).toBe("Dane zgrane. Wróć do Genzō po zapłatę");
    talkToGenzo(session);
    expect(text(ui)).toContain("Czyste dane");
    close(session);
    expect(session.sim.domain.contracts.completed).toBe(3);
    expect(ui.getState().objective).toBe("Kaito ma kolejne kontrakty, Genzō na Nabrzeżu też. Mori sprzedaje cyberware.");
  });

  it("the sniper's laser reaches the renderer as an effect", async () => {
    const { session, ui } = await setup();
    talkToGenzo(session);
    choose(session, ui, "Który terminal mam złamać?");
    close(session);
    const t = DOKI_TERMINAL_SPOTS.quay_terminal!;
    teleport(session, t.x, t.z - 1.4, 0);
    effects.length = 0;
    steps(session, 1, frame({ interact: true }));
    for (let i = 0; i < 3 * SIM_HZ && !effects.some((e) => e.kind === "laser"); i++) steps(session, 1);
    expect(effects.find((e) => e.kind === "laser")).toMatchObject({ kind: "laser", duration: expect.any(Number) });
  });
});
