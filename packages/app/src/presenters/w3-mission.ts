import {
  type AudioPort,
  type DomainState,
  type LineScreens,
  type RenderPort,
  SABOTAGE_LOUD,
  type Vec3,
  W3_STATIONS,
  type W3StationId,
  W3_VIRUS_FLAG,
  contractAlarmFlag,
  contractKind,
  stationDownFlag,
} from "@seki/core";
import { SIM_HZ, inW3Zone, stationChargeAt } from "@seki/sim";

/** What W-3's line shows of the job (ADR-0082 stage 3): the lockdown's beacons, the screens, the stations blown (3b). */
export interface W3MissionVm {
  readonly alarm: boolean;
  readonly screens: LineScreens;
  readonly blown: readonly W3StationId[];
  /** Charges planted on the line so far (the loud way, 3b). */
  readonly planted: number;
}

/**
 * The line's state from the domain: the running sabotage's alarm turns the beacons red; the
 * screens show the upload while it runs and the virus for good once it is in; a station is blown
 * for good once its charge went off.
 */
export const w3MissionOf = (domain: DomainState): W3MissionVm => {
  const c = domain.contracts.active;
  const sabotage = c?.status === "active" && contractKind(c) === "sabotage" ? c : null;
  const alarm = !!sabotage && domain.flags.includes(contractAlarmFlag(sabotage.id));
  const screens: LineScreens = domain.flags.includes(W3_VIRUS_FLAG) ? "infected" : sabotage?.progress !== undefined && sabotage.route !== "loud" ? "upload" : "idle";
  const blown = W3_STATIONS.filter((s) => domain.flags.includes(stationDownFlag(s)));
  return { alarm, screens, blown, planted: sabotage?.charges?.length ?? 0 };
};

/** One wail of the siren (the `alarm-siren` cue) lasts this long; it starts again while the alarm lasts (s). */
export const SIREN_PERIOD = 2.4;

/**
 * Sends the line's state to the renderer as world state (`alarm-light`, `line-screens`,
 * `line-wrecks`), only when it changes, and again after the views were cleared (a new game, a
 * load): the wrecks come back from the stations' flags. What happens now plays only when it
 * happens, not again after a load (ADR-0082 stage 3c): a station's blast as an `explosion` and
 * its sound, the alarm's klaxon and the lockdown's bolts; the siren wails while the alarm lasts and
 * Seki is in W-3's zone. A charge planted and the virus in the core have their sounds (stage 4).
 */
export class W3MissionSync {
  private sent: W3MissionVm | null = null;
  /** The siren's last wail (a count of periods of the simulation's ticks), null while it is silent. */
  private wail: number | null = null;

  constructor(
    private readonly render: RenderPort,
    private readonly audio: AudioPort,
  ) {}

  reset(): void {
    this.sent = null;
    this.wail = null;
  }

  /** One rendered frame: the domain, the simulation's tick and where Seki is (null without her). */
  frame(domain: DomainState, tick: number, seki: Vec3 | null): void {
    const next = w3MissionOf(domain);
    const last = this.sent;
    if (last?.alarm !== next.alarm) this.render.playEffect({ kind: "alarm-light", active: next.alarm });
    if (last && !last.alarm && next.alarm) this.audio.play("alarm");
    if (last?.screens !== next.screens) this.render.playEffect({ kind: "line-screens", state: next.screens });
    if (!last || last.blown.join() !== next.blown.join()) this.render.playEffect({ kind: "line-wrecks", stations: next.blown });
    const fresh = last ? next.blown.filter((s) => !last.blown.includes(s)) : [];
    for (const s of fresh) this.render.playEffect({ kind: "explosion", at: stationChargeAt(s), radius: SABOTAGE_LOUD.blastRadius });
    if (fresh.length > 0) this.audio.play("explosion");
    if (last && next.planted > last.planted) this.audio.play("charge-plant");
    if (last?.screens === "upload" && next.screens === "infected") this.audio.play("upload-done");
    this.siren(next.alarm && seki !== null && inW3Zone(seki.x, seki.z), tick);
    this.sent = next;
  }

  /** A wail every `SIREN_PERIOD` of game time while `on`, the first a period after it came on. */
  private siren(on: boolean, tick: number): void {
    if (!on) {
      this.wail = null;
      return;
    }
    const beat = Math.floor(tick / Math.round(SIREN_PERIOD * SIM_HZ));
    if (this.wail !== null && beat !== this.wail) this.audio.play("alarm-siren");
    this.wail = beat;
  }
}
