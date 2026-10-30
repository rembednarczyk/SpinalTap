import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Contract, type DomainEvents, type EntityId, type InputFrame, createDomainState } from "@seki/core";
import { STORY_SOURCE } from "@seki/narrative";
import { SIM_HZ, type Entity } from "@seki/sim";
import { DEFAULT_SETTINGS, type PhoneMessageVm, patchUi } from "@seki/ui";
import { bonusVm, debriefVm } from "../src/contract-hud";
import { INFO_GAP, PhoneInbox, PhoneQueue, contactName, createKnotRenderer, noticeSeconds } from "../src/phone";
import { hashId, passerBy, scanKind, scanTargetVm } from "../src/scan-view";
import { applyEffects, sanitizeSettings } from "../src/settings";
import { COMBAT_SECONDS } from "../src/wave1-hud";
import { frame, setup, steps } from "./story-helpers";

const msg = (id: number, priority: PhoneMessageVm["priority"], over: Partial<PhoneMessageVm> = {}): PhoneMessageVm => ({
  id,
  from: "kaito",
  contact: "Kaito",
  kind: priority === "story" ? "call" : "text",
  priority,
  lines: [{ speaker: "Kaito", text: `wiadomość ${id}` }],
  time: "22:00",
  ...over,
});

const quiet = (t: number) => ({ t, busy: false, calm: true });

describe("phone queue", () => {
  it("shows one banner at a time, in priority order", () => {
    const q = new PhoneQueue();
    q.push(msg(1, "info"));
    q.push(msg(2, "contract"));
    const first = q.update(quiet(100));
    expect(first?.message.id).toBe(2);
    expect(first?.holocall).toBe(false);
    // The same object while it stays up.
    expect(q.update(quiet(101))).toBe(first);
    // Contract text: 5 s. Then news waits for its quiet gap.
    expect(q.update(quiet(105))).toBeNull();
    expect(q.update(quiet(105 + INFO_GAP - 0.1))).toBeNull();
    expect(q.update(quiet(105 + INFO_GAP))?.message.id).toBe(1);
  });

  it("lets only story through a conversation or a fight, and a story call pushes a banner aside", () => {
    const q = new PhoneQueue();
    q.push(msg(1, "contract"));
    expect(q.update({ t: 0, busy: true, calm: false })).toBeNull();
    expect(q.update(quiet(1))?.message.id).toBe(1);
    q.push(msg(2, "story"));
    const call = q.update({ t: 2, busy: true, calm: false });
    expect(call?.holocall).toBe(true);
    expect(call?.message.id).toBe(2);
    // The contract banner comes back once the call is over and it is quiet again.
    const end = 2 + noticeSeconds(msg(2, "story"));
    expect(q.update({ t: end, busy: true, calm: false })).toBeNull();
    expect(q.waiting).toBe(1);
    expect(q.update(quiet(end + 1))?.message.id).toBe(1);
    // A fight hides it again.
    expect(q.update({ t: end + 2, busy: true, calm: false })).toBeNull();
    q.clear();
    expect(q.waiting).toBe(0);
    expect(q.update(quiet(500))).toBeNull();
  });

  it("news waits for calm, not only for the end of a fight", () => {
    const q = new PhoneQueue();
    q.push(msg(1, "info"));
    expect(q.update({ t: 50, busy: false, calm: false })).toBeNull();
    expect(q.update(quiet(51))?.message.id).toBe(1);
  });

  it("keeps a holocall up as long as it takes to read", () => {
    expect(noticeSeconds(msg(1, "contract"))).toBe(5);
    expect(noticeSeconds(msg(1, "story", { lines: [{ speaker: null, text: "a" }] }))).toBe(4);
    expect(noticeSeconds(msg(1, "story", { lines: [{ speaker: null, text: "x".repeat(400) }] }))).toBe(12);
  });
});

describe("phone inbox and knots", () => {
  it("keeps a thread per contact, latest first, and counts the unread", () => {
    const inbox = new PhoneInbox();
    inbox.add(msg(1, "contract"));
    inbox.add(msg(2, "info", { from: "hana", contact: "Hana" }));
    const vm = inbox.add(msg(3, "contract"));
    expect(vm.threads.map((t) => t.from)).toEqual(["kaito", "hana"]);
    expect(vm.unread).toBe(3);
    expect(vm.threads[0]?.messages.map((m) => m.id)).toEqual([1, 3]);
    const read = inbox.read("kaito");
    expect(read.unread).toBe(1);
    expect(inbox.read("kaito")).toBe(read);
    expect(inbox.read("nobody")).toBe(read);
    expect(inbox.clear()).toEqual({ threads: [], unread: 0 });
  });

  it("names contacts", () => {
    expect(contactName("genzo")).toBe("Genzō");
    expect(contactName("ume")).toBe("Ume");
    expect(contactName("")).toBe("Nieznany");
  });

  it("renders an ink knot on its own runtime, with a fallback for a missing one", () => {
    let locale: "en" | "pl" = "en";
    const render = createKnotRenderer(STORY_SOURCE, () => locale);
    const domain = createDomainState();
    const lines = render("oyaji_closed", domain);
    expect(lines[0]?.speaker).toBe("Oyaji");
    expect(lines.at(-1)?.text).toContain("Wróć po ósmej");
    expect(render("no_such_knot", domain)).toEqual([{ speaker: null, text: "New message." }]);
    locale = "pl";
    expect(render("no_such_knot", domain)).toEqual([{ speaker: null, text: "Nowa wiadomość." }]);
  });
});

const contract: Contract = { id: "c4", kind: "infiltrate", siteId: "car_wash", targets: 2, reward: 1200, status: "cleared" } as Contract;

describe("contract view models", () => {
  it("builds the debrief with the fixer's style badges", () => {
    const e: DomainEvents["ContractDebrief"] = { contractId: "c4", badges: ["ghost", "netrunner"], rank: "B", reward: 1200, bonus: 0, styleBonus: 150, seconds: 90 };
    const vm = debriefVm(e, contract);
    expect(vm.title).toBe("Infiltracja");
    expect(vm.fixer).toBe("Genzō");
    expect(vm.badges).toHaveLength(6);
    expect(vm.badges.find((b) => b.id === "ghost")).toEqual({ id: "ghost", earned: true, style: true });
    expect(vm.badges.find((b) => b.id === "clean")).toEqual({ id: "clean", earned: false, style: true });
    expect(vm.badges.find((b) => b.id === "swift")).toEqual({ id: "swift", earned: false, style: false });
    expect(debriefVm(e, null)).toMatchObject({ title: "Zlecenie", fixer: null });
    expect(bonusVm({ contractId: "c4", condition: { badge: "no_alarm", label: "Bez alarmu", bonus: 300 }, kept: false })).toEqual({ label: "Bez alarmu", badge: "no_alarm", bonus: 300, kept: false });
  });
});

describe("scanner view models", () => {
  const base = { prevPosition: { x: 0, y: 0, z: 0 }, position: { x: 0, y: 0, z: 0 }, yaw: 0, prevYaw: 0, pitch: 0 };
  it("profiles a passer-by from the id alone", () => {
    expect(passerBy(31, "en")).toEqual(passerBy(31, "en"));
    expect(passerBy(31, "en").profile).toHaveLength(3);
    // The same person in both languages: the same name, the lines picked by position.
    const pl = passerBy(31, "pl");
    expect(pl.name).toBe(passerBy(31, "en").name);
    expect(pl.profile).toHaveLength(3);
    expect(pl.profile).not.toEqual(passerBy(31, "en").profile);
    expect(hashId(1)).not.toBe(hashId(2));
  });

  it("tells people, devices and cameras apart", () => {
    const civ = { ...base, id: 31, health: { current: 50, max: 50 }, civilian: {}, faction: "civilians" } as unknown as Entity;
    expect(scanKind(civ)).toBe("person");
    expect(scanTargetVm(civ, "en")).toMatchObject({ kind: "person", name: passerBy(31, "en").name, faction: "Mieszkańcy Lublina", hostile: false });
    const enemy = { ...base, id: 32, health: { current: 80, max: 80 }, ai: {}, enemy: { type: "tessen_guard" }, faction: "tessen" } as unknown as Entity;
    expect(scanTargetVm(enemy, "en")).toMatchObject({ name: "Tessen guard", hostile: true });
    expect(scanTargetVm(enemy, "pl")).toMatchObject({ name: "Strażnik Tessen" });
    const kaito = { ...base, id: 33, health: { current: 50, max: 50 }, interactable: { kind: "dialogue", dialogueId: "fixer" } } as unknown as Entity;
    expect(scanTargetVm(kaito, "en")).toMatchObject({ name: "Kaito", profile: null });
    const terminal = { ...base, id: 34, interactable: { kind: "terminal", dialogueId: "crane" } } as unknown as Entity;
    expect(scanTargetVm(terminal, "en")).toMatchObject({ kind: "device", name: "Terminal" });
    const sign = { ...base, id: 36 } as unknown as Entity;
    expect(scanTargetVm(sign, "en")).toMatchObject({ kind: "device", name: "Device", faction: null });
    expect(scanTargetVm(sign, "pl")).toMatchObject({ name: "Urządzenie" });
    const camera = { ...base, id: 35, key: "docks-camera-1" } as unknown as Entity;
    expect(scanTargetVm(camera, "en")).toMatchObject({ kind: "camera", name: "Security camera" });
  });
});

describe("settings of wave 1", () => {
  it("fills the new fields of an old entry with the defaults and repairs bad values", () => {
    const old = sanitizeSettings({ quality: "low", volume: 0.3 });
    expect(old).toMatchObject({ hudAlwaysShow: false, damageNumbers: "off", hudScale: 1, legibleFont: false, reduceFlashes: false, untimedBreach: false, colorblind: "off" });
    const bad = sanitizeSettings({ hudScale: 9, damageNumbers: "loud", colorblind: "red", legibleFont: "yes", reduceFlashes: 1 });
    expect(bad).toMatchObject({ hudScale: 1.4, damageNumbers: "off", colorblind: "off", legibleFont: false, reduceFlashes: false });
    expect(sanitizeSettings({ hudScale: 1.234, damageNumbers: "total", colorblind: "deutan", untimedBreach: true, hudAlwaysShow: true })).toMatchObject({
      hudScale: 1.25,
      damageNumbers: "total",
      colorblind: "deutan",
      untimedBreach: true,
      hudAlwaysShow: true,
    });
    expect(sanitizeSettings({}, { ...DEFAULT_SETTINGS, reduceFlashes: true }).reduceFlashes).toBe(true);
  });

  it("hands the flash flag to a renderer that takes it", () => {
    const target = { setReduceFlashes: vi.fn() };
    applyEffects(target, { reduceFlashes: true });
    expect(target.setReduceFlashes).toHaveBeenCalledWith(true);
    expect(() => applyEffects({}, { reduceFlashes: true })).not.toThrow();
  });
});

describe("game session: wave 1 events on the HUD", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const start = () => {
    const t = setup();
    t.session.newGame();
    steps(t.session, 1);
    const player = t.session.sim.player()!;
    const others = [...t.session.sim.world].filter((e) => !e.player && e.health && (e.civilian || e.ai || e.interactable));
    return { ...t, player, npc: others[0]!, others };
  };
  const emit = <K extends keyof DomainEvents>(s: ReturnType<typeof setup>["session"], type: K, payload: DomainEvents[K]) => {
    s.bus.emit(type, payload);
    s.syncHud();
  };

  it("queues phone messages by priority and keeps them in the inbox", () => {
    const { session, ui } = start();
    emit(session, "PhoneMessage", { from: "oyaji", kind: "text", knot: "oyaji_closed", priority: "contract" });
    expect(ui.getState().phone.unread).toBe(1);
    expect(ui.getState().phone.threads[0]?.messages[0]?.lines[0]?.speaker).toBe("Oyaji");
    expect(ui.getState().phoneNotice?.message.contact).toBe("Oyaji");
    // A story call interrupts it at once.
    emit(session, "PhoneMessage", { from: "hana", kind: "call", knot: "missing", priority: "story" });
    expect(ui.getState().phoneNotice?.holocall).toBe(true);
    // The phone opens, takes the controls and gives them back.
    session.intents.openPhone();
    expect(ui.getState().phoneOpen).toBe(true);
    expect(session.inControl).toBe(false);
    session.intents.readThread("oyaji");
    expect(ui.getState().phone.unread).toBe(1);
    session.intents.closePhone();
    expect(session.inControl).toBe(true);
  });

  it("shows the debrief of the contract just paid and the condition bonus", () => {
    const { session, ui } = start();
    emit(session, "ContractBonusChanged", { contractId: "c4", condition: { badge: "no_alarm", label: "Nie podnoś alarmu", bonus: 300 }, kept: true });
    expect(ui.getState().contractBonus?.kept).toBe(true);
    emit(session, "ContractCompleted", { contract, reward: 1200 });
    expect(ui.getState().contractBonus).toBeNull();
    emit(session, "ContractDebrief", { contractId: "c4", badges: ["ghost"], rank: "B", reward: 1200, bonus: 300, styleBonus: 150, seconds: 80 });
    expect(ui.getState().debrief).toMatchObject({ title: "Infiltracja", fixer: "Genzō", rank: "B" });
    session.intents.dismissDebrief();
    expect(ui.getState().debrief).toBeNull();
  });

  it("shows heat, dims it while searching and blinks it before the drop", () => {
    const { session, ui } = start();
    emit(session, "HeatChanged", { level: 2, previous: 0, searching: false, lastKnown: null, searchLeft: 0 });
    expect(ui.getState().heat).toEqual({ level: 2, searching: false, ending: false });
    expect(ui.getState().toasts.at(-1)?.title).toContain("★★");
    expect(ui.getState().combat).toBe(true);
    emit(session, "HeatChanged", { level: 2, previous: 2, searching: true, lastKnown: { x: 3.1, y: 0, z: 4.2 }, searchLeft: 6 });
    expect(ui.getState().heat.ending).toBe(false);
    expect(ui.getState().lastKnown).toEqual({ x: 3, z: 4 });
    steps(session, Math.ceil(1.5 * SIM_HZ));
    expect(ui.getState().heat).toEqual({ level: 2, searching: true, ending: true });
    emit(session, "HeatChanged", { level: 0, previous: 1, searching: false, lastKnown: null, searchLeft: 0 });
    expect(ui.getState().heat.level).toBe(0);
    expect(ui.getState().lastKnown).toBeNull();
  });

  it("points detection arcs at the observer and drops them when it calms down", () => {
    const { session, ui, player, npc } = start();
    emit(session, "AwarenessChanged", { observerId: npc.id, state: "searching", level: 0.62, lastKnown: { x: 1, y: 0, z: 2 } });
    const d = ui.getState().detection;
    expect(d).toHaveLength(1);
    const expected = Math.atan2(npc.position.x - player.position.x, npc.position.z - player.position.z) - player.yaw;
    expect(Math.abs(Math.atan2(Math.sin(d[0]!.angle - expected), Math.cos(d[0]!.angle - expected)))).toBeLessThan(0.05);
    expect(d[0]).toMatchObject({ state: "searching", level: 0.6 });
    expect(ui.getState().lastKnown).toEqual({ x: 1, z: 2 });
    // The same frame again keeps the same array (no re-render).
    session.syncHud();
    expect(ui.getState().detection).toBe(d);
    emit(session, "AwarenessChanged", { observerId: npc.id, state: "unaware", level: 0, lastKnown: null });
    expect(ui.getState().detection).toEqual([]);
    expect(ui.getState().lastKnown).toBeNull();
  });

  it("marks a calling witness until the call lands, then raises a toast", () => {
    const { session, ui, player, npc } = start();
    emit(session, "WitnessCalling", { witnessId: npc.id, crime: "gunfire", duration: 3 });
    expect(ui.getState().witnesses).toEqual([expect.objectContaining({ id: `w${npc.id}` })]);
    emit(session, "CrimeReported", { crime: "gunfire", channel: "civilian", witnessId: npc.id, offenderId: player.id, at: player.position });
    expect(ui.getState().witnesses).toEqual([]);
    expect(ui.getState().toasts.at(-1)).toMatchObject({ kind: "heat", title: "Świadek zadzwonił: strzelanina" });
    // A call that is never reported fades after its time.
    emit(session, "WitnessCalling", { witnessId: npc.id, crime: "assault", duration: 1 });
    steps(session, 3 * SIM_HZ);
    expect(ui.getState().witnesses).toEqual([]);
  });

  it("fills the scanner card, the upload, RAM and the notes", () => {
    const { session, ui, npc } = start();
    emit(session, "ScanFocusChanged", { targetId: npc.id });
    expect(ui.getState().scanTarget?.id).toBe(npc.id);
    emit(session, "RamChanged", { current: 5, max: 8 });
    expect(ui.getState().ram).toEqual({ current: 5, max: 8 });
    emit(session, "QuickhackStarted", { hackId: "ping", targetId: npc.id, upload: 0.6, ram: 2 });
    expect(ui.getState().upload).toMatchObject({ hackId: "ping", seconds: 0.6 });
    emit(session, "QuickhackApplied", { hackId: "ping", targetId: npc.id, duration: 12 });
    expect(ui.getState().upload).toBeNull();
    expect(ui.getState().scanNote).toMatchObject({ tone: "ok", text: "Ping: wgrano" });
    emit(session, "QuickhackStarted", { hackId: "short_circuit", targetId: npc.id, upload: 1.5, ram: 5 });
    emit(session, "QuickhackFailed", { hackId: "short_circuit", targetId: npc.id, reason: "lost-target" });
    expect(ui.getState().upload).toBeNull();
    expect(ui.getState().scanNote?.text).toContain("wraca połowa RAM");
    emit(session, "QuickhackTraced", { hackId: "ping", targetId: npc.id });
    expect(ui.getState().scanNote?.tone).toBe("traced");
    steps(session, 3 * SIM_HZ);
    expect(ui.getState().scanNote).toBeNull();
    emit(session, "ScanFocusChanged", { targetId: null });
    expect(ui.getState().scanTarget).toBeNull();
    emit(session, "BreachCompleted", { terminalKey: "crane", daemons: ["datamine", "icepick"] });
    expect(ui.getState().toasts.at(-1)).toMatchObject({ title: "Breach complete", text: "Daemons: Datamine, ICEpick" });
    emit(session, "BreachCompleted", { terminalKey: "crane", daemons: [] });
    expect(ui.getState().toasts.at(-1)).toMatchObject({ title: "Breach complete", text: "Nothing uploaded" });
    patchUi(ui, { settings: { ...ui.getState().settings, locale: "pl" } });
    emit(session, "BreachCompleted", { terminalKey: "crane", daemons: ["datamine", "mass_vulnerability"] });
    expect(ui.getState().toasts.at(-1)).toMatchObject({ title: "Włamanie zakończone", text: "Demony: Kopacz danych, Masowa podatność" });
    emit(session, "BreachCompleted", { terminalKey: "crane", daemons: [] });
    expect(ui.getState().toasts.at(-1)).toMatchObject({ title: "Włamanie zakończone", text: "Nic nie wgrano" });
  });

  it("marks crits and kills by the player, counts damage numbers and keeps the HUD in combat", () => {
    const { session, ui, player, npc } = start();
    expect(ui.getState().combat).toBe(false);
    const hit = (amount: number, critical = false) =>
      emit(session, "DamageDealt", { sourceId: player.id, targetId: npc.id, amount, critical, zone: "torso", at: npc.position });
    session.intents.changeSettings({ damageNumbers: "total" });
    hit(10, true);
    expect(ui.getState().hitKind).toBe("crit");
    hit(5);
    expect(ui.getState().damageNumbers).toEqual([{ id: expect.any(Number), amount: 15, critical: true, rev: 1 }]);
    expect(ui.getState().combat).toBe(true);
    emit(session, "EntityKilled", { entityId: npc.id, tag: null });
    expect(ui.getState().hitKind).toBe("kill");
    session.intents.changeSettings({ damageNumbers: "hit" });
    hit(3);
    hit(4);
    expect(ui.getState().damageNumbers.map((n) => n.amount)).toEqual([15, 3, 4]);
    steps(session, 2 * SIM_HZ);
    expect(ui.getState().damageNumbers).toEqual([]);
    steps(session, COMBAT_SECONDS * SIM_HZ);
    expect(ui.getState().combat).toBe(false);
    // Off: nothing is counted.
    session.intents.changeSettings({ damageNumbers: "off" });
    hit(3);
    expect(ui.getState().damageNumbers).toEqual([]);
  });

  it("plays a breach and sends its result as a command", () => {
    const { session, ui } = start();
    const enqueue = vi.spyOn(session.sim, "enqueue");
    session.openBreach("crane", ["icepick", "datamine"]);
    expect(ui.getState().breach).toEqual({ terminalKey: "crane", daemons: ["icepick", "datamine"] });
    expect(session.inControl).toBe(false);
    session.intents.submitBreach(["icepick"]);
    expect(enqueue).toHaveBeenCalledWith({ type: "breach-result", terminalKey: "crane", daemons: ["icepick"] });
    expect(ui.getState().breach).toBeNull();
    expect(session.inControl).toBe(true);
    session.intents.submitBreach(["datamine"]);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("feeds the touch scanner and a tapped hack into the input frame", () => {
    const { session, ui } = start();
    const step = vi.spyOn(session.sim, "step");
    session.intents.pickQuickhack(2);
    session.step(frame());
    expect((step.mock.calls.at(-1)?.[0] as InputFrame).quickhack).toBe(0);
    session.intents.setScan(true);
    session.intents.pickQuickhack(2);
    session.step(frame());
    expect(step.mock.calls.at(-1)?.[0]).toMatchObject({ scan: true, quickhack: 2 });
    expect(ui.getState().scanning).toBe(true);
    session.step(frame());
    expect(step.mock.calls.at(-1)?.[0]).toMatchObject({ scan: true, quickhack: 0 });
    session.intents.setScan(false);
    session.step(frame({ scan: true }));
    expect(ui.getState().scanning).toBe(true);
    session.step(frame());
    expect(ui.getState().scanning).toBe(false);
  });

  it("clears the pursuit and the banners on a new game", () => {
    const { session, ui, npc } = start();
    emit(session, "HeatChanged", { level: 1, previous: 0, searching: false, lastKnown: null, searchLeft: 0 });
    emit(session, "WitnessCalling", { witnessId: npc.id as EntityId, crime: "assault", duration: 3 });
    patchUi(ui, { debrief: debriefVm({ contractId: "x", badges: [], rank: "C", reward: 0, bonus: 0, styleBonus: 0, seconds: 0 }, null) });
    session.newGame();
    expect(ui.getState().heat.level).toBe(0);
    expect(ui.getState().witnesses).toEqual([]);
    expect(ui.getState().debrief).toBeNull();
  });
});
