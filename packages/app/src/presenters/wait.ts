import { COMBAT_RADIUS, contractAlarmFlag } from "@seki/core";
import type { Simulation } from "@seki/sim";
import type { WaitBlock } from "@seki/ui";

/** What the app knows besides the simulation: the HUD's fight and a jump or a fall under way. */
export interface WaitFacts {
  /** The HUD's combat state: shot at lately, or someone fighting or hunting the player. */
  readonly fighting: boolean;
  readonly airborne: boolean;
}

/** An awake, alerted NPC within the fight's radius of the player, as the difficulty counts a fight (ADR-0066). */
const alertedNear = (sim: Simulation): boolean => {
  const player = sim.player();
  if (!player) return false;
  for (const g of sim.world.with("ai")) {
    if (!g.ai.alerted || g.unconscious || (g.health && g.health.current <= 0)) continue;
    if (Math.hypot(g.position.x - player.position.x, g.position.z - player.position.z) <= COMBAT_RADIUS) return true;
  }
  return false;
};

/**
 * Why the hours cannot pass now, null when they can. The `wait` command itself refuses nothing
 * (ADR-0017: a cut, the world placed on its schedules), so the window is where the rules live:
 * no waiting out a fight, a contract's raised alarm or a pursuit, nor in a takedown, a
 * conversation, on the metro or in the air.
 */
export const waitBlock = (sim: Simulation, facts: WaitFacts): WaitBlock | null => {
  const { domain, session } = sim;
  const player = sim.player();
  if (!player || (player.health?.current ?? 0) <= 0 || session.gameOver) return "busy";
  if (facts.fighting || alertedNear(sim)) return "combat";
  const contract = domain.contracts.active;
  if (contract && domain.flags.includes(contractAlarmFlag(contract.id))) return "alarm";
  if (domain.heat.level > 0) return "wanted";
  if (session.takedown || session.dialogueActive || session.passenger || domain.metro.ride || facts.airborne) return "busy";
  return null;
};
