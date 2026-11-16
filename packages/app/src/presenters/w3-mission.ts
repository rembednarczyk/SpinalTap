import { type DomainState, type LineScreens, type RenderPort, W3_VIRUS_FLAG, contractAlarmFlag, contractKind } from "@seki/core";

/** What W-3's line shows of the job (ADR-0082 stage 3): the lockdown's beacons and the screens. */
export interface W3MissionVm {
  readonly alarm: boolean;
  readonly screens: LineScreens;
}

/**
 * The line's state from the domain: the running sabotage's alarm turns the beacons red; the
 * screens show the upload while it runs and the virus for good once it is in.
 */
export const w3MissionOf = (domain: DomainState): W3MissionVm => {
  const c = domain.contracts.active;
  const sabotage = c?.status === "active" && contractKind(c) === "sabotage" ? c : null;
  const alarm = !!sabotage && domain.flags.includes(contractAlarmFlag(sabotage.id));
  const screens: LineScreens = domain.flags.includes(W3_VIRUS_FLAG) ? "infected" : sabotage?.progress !== undefined ? "upload" : "idle";
  return { alarm, screens };
};

/**
 * Sends the line's state to the renderer as world state (`alarm-light`, `line-screens`), only
 * when it changes, and again after the views were cleared (a new game, a load).
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
    this.sent = next;
  }
}
