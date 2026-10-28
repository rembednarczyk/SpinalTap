import {
  type AwarenessState,
  type Contract,
  type DomainEvents,
  type DomainState,
  type EntityId,
  type EventBus,
  QUICKHACKS,
  type QuickhackFailure,
  type Vec3,
  type CrimeKind,
} from "@seki/core";
import type { Entity } from "@seki/sim";
import {
  type DamageNumberVm,
  type DamageNumbersMode,
  type DetectionVm,
  type HeatVm,
  type MapPointVm,
  NO_HEAT,
  type PhoneLineVm,
  type ScanNoteVm,
  type UiState,
  type UiStore,
  dismissToast,
  patchUi,
  pushToast,
} from "@seki/ui";
import { bonusVm, debriefVm } from "./contract-hud";
import { PhoneInbox, PhoneQueue, contactName } from "./phone";
import { scanTargetVm } from "./scan-view";

/** Seconds of the heat search under which the stars blink. */
export const HEAT_ENDING_SECONDS = 5;
/** A hit by the player keeps the HUD in combat this long. */
export const COMBAT_SECONDS = 5;
const NOTE_SECONDS = 2.5;
const NUMBER_SECONDS = 0.9;
const TOTAL_SECONDS = 1.5;
const NUMBER_LIMIT = 6;
const ANGLE_STEP = Math.PI / 36;
const LEVEL_STEP = 1 / 20;
const MAP_SNAP = 0.5;

const CRIME_TEXT: Readonly<Record<CrimeKind, string>> = {
  gunfire: "strzelanina",
  assault: "napaść",
  murder: "zabójstwo",
  trespass: "wtargnięcie",
  hacking: "włamanie do sieci",
};

const CHANNEL_TEXT: Readonly<Record<DomainEvents["CrimeReported"]["channel"], string>> = {
  civilian: "Świadek zadzwonił",
  camera: "Kamera nagrała",
  patrol: "Patrol widział",
};

export const FAILURE_TEXT: Readonly<Record<QuickhackFailure, string>> = {
  "no-ram": "Za mało RAM",
  "out-of-range": "Cel poza zasięgiem",
  "lost-target": "Utracono cel, wraca połowa RAM",
  "wrong-target": "Ten hack nie działa na ten cel",
  busy: "Trwa inny upload",
};

const DAEMON_TEXT: Readonly<Record<string, string>> = { icepick: "ICEpick", datamine: "Kopacz danych", mass_vulnerability: "Masowa podatność" };

const snap = (v: number, step: number) => Math.round(v / step) * step;

interface Observer {
  readonly state: Exclude<AwarenessState, "unaware">;
  readonly level: number;
  readonly lastKnown: Vec3 | null;
  readonly seq: number;
}

interface DamageEntry {
  id: number;
  target: EntityId;
  amount: number;
  critical: boolean;
  rev: number;
  /** Tick of the last hit it counts. */
  tick: number;
}

export interface Wave1Hooks {
  readonly playerId: () => EntityId | null;
  readonly domain: () => DomainState;
  readonly clock: () => string;
  readonly tick: () => number;
  readonly ticksPerSecond: number;
  readonly damageMode: () => DamageNumbersMode;
  /** Renders a phone knot to lines. */
  readonly renderKnot: (knot: string, domain: DomainState) => PhoneLineVm[];
  readonly toastMs?: number;
}

export interface Wave1Frame {
  readonly world: Iterable<Entity>;
  readonly player: Entity | undefined;
  /** In a conversation, a shop, a breach or combat. */
  readonly busy: boolean;
  /** Nothing on at all: news may reach the phone. */
  readonly calm: boolean;
}

/**
 * Presentation of wave 1 (ADR-0028): maps the new domain events to the UI store (phone,
 * debrief, condition bonus, heat and detection, witnesses, scanner, quickhacks, combat
 * feedback) and keeps the per-frame parts (directions, timers) in step with the world.
 */
export class Wave1Hud {
  readonly queue = new PhoneQueue();
  readonly inbox = new PhoneInbox();
  private observers = new Map<EntityId, Observer>();
  private witnesses = new Map<EntityId, number>();
  private heat: DomainEvents["HeatChanged"] | null = null;
  private heatTick = 0;
  private lastContract: Contract | null = null;
  private focusId: EntityId | null = null;
  private noteTick = 0;
  private numbers: DamageEntry[] = [];
  private numberSeq = 0;
  private messageSeq = 0;
  private uploadSeq = 0;
  private observerSeq = 0;
  private lastHitTarget: EntityId | null = null;
  private lastHitTick = -Infinity;
  private noteSeq = 0;
  private last: Partial<UiState> = {};
  private readonly offs: (() => void)[];

  constructor(
    bus: EventBus<DomainEvents>,
    private readonly ui: UiStore,
    private readonly hooks: Wave1Hooks,
  ) {
    const isPlayer = (id: EntityId) => id === hooks.playerId();
    this.offs = [
      bus.on("PhoneMessage", (e) => this.receive(e)),
      bus.on("ContractAccepted", () => patchUi(ui, { contractBonus: null })),
      bus.on("ContractCompleted", (e) => {
        this.lastContract = e.contract;
        patchUi(ui, { contractBonus: null });
      }),
      bus.on("ContractFailed", () => patchUi(ui, { contractBonus: null })),
      bus.on("ContractBonusChanged", (e) => patchUi(ui, { contractBonus: bonusVm(e) })),
      bus.on("ContractDebrief", (e) => {
        const contract = this.lastContract?.id === e.contractId ? this.lastContract : null;
        patchUi(ui, { debrief: debriefVm(e, contract) });
      }),
      bus.on("HeatChanged", (e) => {
        this.heat = e;
        this.heatTick = hooks.tick();
        if (e.level > e.previous) this.toast("heat", `Pościg: ${"★".repeat(e.level)}`, "Ochrona dystryktu cię szuka");
      }),
      bus.on("AwarenessChanged", (e) => {
        if (e.state === "unaware") this.observers.delete(e.observerId);
        else this.observers.set(e.observerId, { state: e.state, level: e.level, lastKnown: e.lastKnown, seq: ++this.observerSeq });
      }),
      bus.on("WitnessCalling", (e) => this.witnesses.set(e.witnessId, hooks.tick() + Math.ceil((e.duration + 1) * hooks.ticksPerSecond))),
      bus.on("CrimeReported", (e) => {
        this.witnesses.delete(e.witnessId);
        if (isPlayer(e.offenderId)) this.toast("heat", `${CHANNEL_TEXT[e.channel]}: ${CRIME_TEXT[e.crime]}`, "Zgłoszone ochronie");
      }),
      bus.on("EntityKilled", (e) => {
        this.witnesses.delete(e.entityId);
        this.observers.delete(e.entityId);
        // The killing blow came from the player this very step: the kill marker.
        if (e.entityId === this.lastHitTarget && this.lastHitTick === hooks.tick()) {
          patchUi(ui, { hitMarker: ui.getState().hitMarker + 1, hitKind: "kill" });
        }
      }),
      bus.on("DamageDealt", (e) => {
        if (!isPlayer(e.sourceId) || isPlayer(e.targetId)) return;
        this.lastHitTarget = e.targetId;
        this.lastHitTick = hooks.tick();
        this.addDamage(e.targetId, e.amount, e.critical);
      }),
      bus.on("ScanFocusChanged", (e) => {
        this.focusId = e.targetId;
        if (e.targetId === null) patchUi(ui, { scanTarget: null });
      }),
      bus.on("RamChanged", (e) => patchUi(ui, { ram: { current: e.current, max: e.max } })),
      bus.on("QuickhackStarted", (e) => patchUi(ui, { upload: { seq: ++this.uploadSeq, hackId: e.hackId, seconds: e.upload } })),
      bus.on("QuickhackApplied", (e) => {
        patchUi(ui, { upload: null });
        this.note("ok", `${QUICKHACKS[e.hackId].title}: wgrano`);
      }),
      bus.on("QuickhackFailed", (e) => {
        if (ui.getState().upload?.hackId === e.hackId) patchUi(ui, { upload: null });
        this.note("fail", `${QUICKHACKS[e.hackId].title}: ${FAILURE_TEXT[e.reason]}`);
      }),
      bus.on("QuickhackTraced", () => this.note("traced", "Namierzono cię! Sieć zna twoją pozycję")),
      bus.on("BreachCompleted", (e) =>
        this.toast("system", "Włamanie zakończone", e.daemons.length > 0 ? `Demony: ${e.daemons.map((d) => DAEMON_TEXT[d] ?? d).join(", ")}` : "Nic nie wgrano"),
      ),
    ];
  }

  dispose(): void {
    for (const off of this.offs) off();
  }

  /** A new game or a load: nothing of the old pursuit or the old phone banners carries over. */
  reset(): void {
    this.observers.clear();
    this.witnesses.clear();
    this.heat = null;
    this.focusId = null;
    this.numbers = [];
    this.lastHitTarget = null;
    this.lastHitTick = -Infinity;
    this.queue.clear();
    this.last = {};
    patchUi(this.ui, {
      heat: NO_HEAT,
      detection: [],
      lastKnown: null,
      witnesses: [],
      scanTarget: null,
      upload: null,
      scanNote: null,
      contractBonus: null,
      debrief: null,
      damageNumbers: [],
      phoneNotice: null,
      phone: this.inbox.clear(),
    });
  }

  /** The player hit someone within the last few seconds. */
  get fighting(): boolean {
    return this.hooks.tick() - this.lastHitTick < COMBAT_SECONDS * this.hooks.ticksPerSecond;
  }

  /** Heat on and not searching, or someone fighting the player. */
  get hunted(): boolean {
    if (this.heat && this.heat.level > 0 && !this.heat.searching) return true;
    for (const o of this.observers.values()) if (o.state === "alerted") return true;
    return false;
  }

  get heatLevel(): number {
    return this.heat?.level ?? 0;
  }

  readThread(from: string): void {
    patchUi(this.ui, { phone: this.inbox.read(from) });
  }

  private receive(e: DomainEvents["PhoneMessage"]): void {
    const message = {
      id: ++this.messageSeq,
      from: e.from,
      contact: contactName(e.from),
      kind: e.kind,
      priority: e.priority,
      lines: this.hooks.renderKnot(e.knot, this.hooks.domain()),
      time: this.hooks.clock(),
    };
    this.queue.push(message);
    patchUi(this.ui, { phone: this.inbox.add(message) });
  }

  private toast(kind: "heat" | "system", title: string, text: string): void {
    const id = pushToast(this.ui, { kind, title, text });
    setTimeout(() => dismissToast(this.ui, id), this.hooks.toastMs ?? 4500);
  }

  private note(tone: ScanNoteVm["tone"], text: string): void {
    this.noteTick = this.hooks.tick();
    patchUi(this.ui, { scanNote: { seq: ++this.noteSeq, tone, text } });
  }

  private addDamage(target: EntityId, amount: number, critical: boolean): void {
    const mode = this.hooks.damageMode();
    if (mode === "off") return;
    const tick = this.hooks.tick();
    const open = mode === "total" ? this.numbers.find((n) => n.target === target) : undefined;
    if (open) {
      open.amount += amount;
      open.critical ||= critical;
      open.rev += 1;
      open.tick = tick;
    } else {
      this.numbers = [...this.numbers, { id: ++this.numberSeq, target, amount, critical, rev: 0, tick }].slice(-NUMBER_LIMIT);
    }
    this.pushNumbers();
  }

  private pushNumbers(): void {
    const vm: DamageNumberVm[] = this.numbers.map((n) => ({ id: n.id, amount: n.amount, critical: n.critical, rev: n.rev }));
    patchUi(this.ui, { damageNumbers: vm });
  }

  /** Per-frame part: directions to observers, the heat countdown, witnesses, phone, expiry. */
  sync(frame: Wave1Frame): Partial<UiState> {
    const hz = this.hooks.ticksPerSecond;
    const tick = this.hooks.tick();
    const wanted = new Set<EntityId>([...this.observers.keys(), ...this.witnesses.keys()]);
    if (this.focusId !== null) wanted.add(this.focusId);
    const found = new Map<EntityId, Entity>();
    if (wanted.size > 0) for (const e of frame.world) if (wanted.has(e.id)) found.set(e.id, e);

    // Damage numbers fade after a moment; a running total once the target is left alone.
    const keep = this.hooks.damageMode() === "total" ? TOTAL_SECONDS : NUMBER_SECONDS;
    const alive = this.numbers.filter((n) => tick - n.tick < keep * hz);
    if (alive.length !== this.numbers.length) {
      this.numbers = alive;
      this.pushNumbers();
    }

    const out: { -readonly [K in keyof UiState]?: UiState[K] } = {
      heat: this.heatVm(tick),
      detection: this.detectionVm(found, frame.player),
      lastKnown: this.lastKnownVm(),
      witnesses: this.witnessVm(found, tick),
      phoneNotice: this.queue.update({ t: tick / hz, busy: frame.busy, calm: frame.calm }),
    };
    if (this.focusId !== null) {
      const target = found.get(this.focusId);
      const prev = this.ui.getState().scanTarget;
      if (!target) out.scanTarget = null;
      else if (prev?.id !== target.id) out.scanTarget = scanTargetVm(target);
    }
    if (this.ui.getState().scanNote && tick - this.noteTick >= NOTE_SECONDS * hz) out.scanNote = null;
    return this.reuse(out);
  }

  /** Hands back the previous objects for values that did not change, so React stays still. */
  private reuse(out: Partial<UiState>): Partial<UiState> {
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(out)) {
      const prev = (this.last as Record<string, unknown>)[k];
      result[k] = prev !== undefined && same(prev, v) ? prev : v;
    }
    this.last = { ...this.last, ...result };
    return result as Partial<UiState>;
  }

  private heatVm(tick: number): HeatVm {
    const h = this.heat;
    if (!h || h.level === 0) return NO_HEAT;
    const left = h.searchLeft - (tick - this.heatTick) / this.hooks.ticksPerSecond;
    return { level: h.level, searching: h.searching, ending: h.searching && left <= HEAT_ENDING_SECONDS };
  }

  private detectionVm(found: ReadonlyMap<EntityId, Entity>, player: Entity | undefined): DetectionVm[] {
    if (!player) return [];
    const out: DetectionVm[] = [];
    for (const [id, o] of this.observers) {
      const e = found.get(id);
      if (!e) continue;
      // Bearing from the player's view: 0 ahead, positive to the right (yaw 0 looks +z, PI/2 +x).
      const bearing = Math.atan2(e.position.x - player.position.x, e.position.z - player.position.z) - player.yaw;
      const angle = snap(Math.atan2(Math.sin(bearing), Math.cos(bearing)), ANGLE_STEP);
      out.push({ id, angle, level: Math.round(Math.min(1, Math.max(0, o.level)) / LEVEL_STEP) / Math.round(1 / LEVEL_STEP), state: o.state });
    }
    return out;
  }

  private lastKnownVm(): { x: number; z: number } | null {
    const h = this.heat;
    if (h && h.level > 0 && h.searching && h.lastKnown) return { x: snap(h.lastKnown.x, MAP_SNAP), z: snap(h.lastKnown.z, MAP_SNAP) };
    let best: Observer | null = null;
    for (const o of this.observers.values()) if (o.lastKnown && o.state !== "suspicious" && (!best || o.seq > best.seq)) best = o;
    return best?.lastKnown ? { x: snap(best.lastKnown.x, MAP_SNAP), z: snap(best.lastKnown.z, MAP_SNAP) } : null;
  }

  private witnessVm(found: ReadonlyMap<EntityId, Entity>, tick: number): MapPointVm[] {
    const out: MapPointVm[] = [];
    for (const [id, until] of this.witnesses) {
      const e = found.get(id);
      if (!e || tick > until) {
        this.witnesses.delete(id);
        continue;
      }
      out.push({ id: `w${id}`, x: snap(e.position.x, MAP_SNAP), z: snap(e.position.z, MAP_SNAP) });
    }
    return out;
  }
}
