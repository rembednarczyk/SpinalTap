import type { AwarenessState, DomainEvents, EntityId, Vec3 } from "@seki/core";
import type { Entity } from "@seki/sim";
import { type DetectionVm, type HeatVm, type MapPointVm, type MessageKey, type MessageParams, NO_HEAT, translate } from "@seki/ui";
import { type HudPart, type HudPartContext, type HudPartFrame, type HudPatch, snap } from "./hud-part";

/** Seconds of the heat search under which the stars blink. */
export const HEAT_ENDING_SECONDS = 5;
const ANGLE_STEP = Math.PI / 36;
const LEVEL_STEP = 1 / 20;
const MAP_SNAP = 0.5;

interface Observer {
  readonly state: Exclude<AwarenessState, "unaware">;
  readonly level: number;
  readonly lastKnown: Vec3 | null;
  readonly seq: number;
}

/** Heat and detection (ADR-0028): the stars, who watches the player, witnesses on the phone, the last known position. */
export class HeatHud implements HudPart {
  readonly offs: readonly (() => void)[];
  private observers = new Map<EntityId, Observer>();
  private witnesses = new Map<EntityId, number>();
  private heat: DomainEvents["HeatChanged"] | null = null;
  private heatTick = 0;
  private observerSeq = 0;

  constructor(private readonly ctx: HudPartContext) {
    const { bus, hooks, isPlayer } = ctx;
    this.offs = [
      bus.on("HeatChanged", (e) => {
        this.heat = e;
        this.heatTick = hooks.tick();
        if (e.level > e.previous) ctx.toast("heat", this.t("heat.chase", { stars: "★".repeat(e.level) }), this.t("heat.chaseText"));
      }),
      bus.on("AwarenessChanged", (e) => {
        if (e.state === "unaware") this.observers.delete(e.observerId);
        else this.observers.set(e.observerId, { state: e.state, level: e.level, lastKnown: e.lastKnown, seq: ++this.observerSeq });
      }),
      bus.on("WitnessCalling", (e) => this.witnesses.set(e.witnessId, hooks.tick() + Math.ceil((e.duration + 1) * hooks.ticksPerSecond))),
      bus.on("CrimeReported", (e) => {
        this.witnesses.delete(e.witnessId);
        if (isPlayer(e.offenderId)) {
          const reported = { channel: this.t(`heat.channel.${e.channel}`), crime: this.t(`heat.crime.${e.crime}`) };
          ctx.toast("heat", this.t("heat.reported", reported), this.t("heat.reportedText"));
        }
      }),
      bus.on("EntityKilled", (e) => {
        this.witnesses.delete(e.entityId);
        this.observers.delete(e.entityId);
      }),
    ];
  }

  /** A toast in the language of the moment (ADR-0056). */
  private t(key: MessageKey, params?: MessageParams): string {
    return translate(this.ctx.ui.getState().settings.locale, key, params);
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

  wanted(): Iterable<EntityId> {
    return [...this.observers.keys(), ...this.witnesses.keys()];
  }

  frame(f: HudPartFrame): HudPatch {
    return { heat: this.heatVm(f.tick), detection: this.detectionVm(f.found, f.player), lastKnown: this.lastKnownVm(), witnesses: this.witnessVm(f.found, f.tick) };
  }

  reset(): HudPatch {
    this.observers.clear();
    this.witnesses.clear();
    this.heat = null;
    return { heat: NO_HEAT, detection: [], lastKnown: null, witnesses: [] };
  }

  private heatVm(tick: number): HeatVm {
    const h = this.heat;
    if (!h || h.level === 0) return NO_HEAT;
    const left = h.searchLeft - (tick - this.heatTick) / this.ctx.hooks.ticksPerSecond;
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
