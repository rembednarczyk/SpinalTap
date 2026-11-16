import { type DomainState, type LineScreens, type RenderPort, W3_STATIONS, type W3StationId, W3_VIRUS_FLAG, contractAlarmFlag, contractKind, stationDownFlag } from "@seki/core";
import { stationChargeAt } from "@seki/sim";

/** What W-3's line shows of the job (ADR-0082 stage 3): the lockdown's beacons, the screens, the stations blown (3b). */
export interface W3MissionVm {
  readonly alarm: boolean;
  readonly screens: LineScreens;
  readonly blown: readonly W3StationId[];
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
  return { alarm, screens, blown };
};

/** Sparks of one charge going off: a burst over the station, the renderer's hit sparks at their brightest. */
const BURST: readonly { readonly dx: number; readonly dy: number; readonly dz: number }[] = [
  { dx: 0, dy: 0.2, dz: 0 },
  { dx: -0.6, dy: 0.7, dz: 0.2 },
  { dx: 0.6, dy: 0.9, dz: -0.2 },
  { dx: 0.1, dy: 1.4, dz: 0.3 },
];

/**
 * Sends the line's state to the renderer as world state (`alarm-light`, `line-screens`), only
 * when it changes, and again after the views were cleared (a new game, a load); the blast of a
 * station as sparks, only when it happens (not again after a load: the wrecks are in the world).
 */
export class W3MissionSync {
  private sent: W3MissionVm | null = null;

  constructor(private readonly render: RenderPort) {}

  reset(): void {
    this.sent = null;
  }

  frame(domain: DomainState): void {
    const next = w3MissionOf(domain);
    const last = this.sent;
    if (last?.alarm !== next.alarm) this.render.playEffect({ kind: "alarm-light", active: next.alarm });
    if (last?.screens !== next.screens) this.render.playEffect({ kind: "line-screens", state: next.screens });
    if (last) for (const s of next.blown) if (!last.blown.includes(s)) this.blast(s);
    this.sent = next;
  }

  private blast(s: W3StationId): void {
    const at = stationChargeAt(s);
    for (const b of BURST) this.render.playEffect({ kind: "hit-spark", at: { x: at.x + b.dx, y: at.y + b.dy, z: at.z + b.dz }, critical: true });
  }
}
