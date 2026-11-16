import type { ThreatSnapshot } from "@seki/core";
import type { World } from "miniplex";
import type { Entity } from "./components";
import type { SessionState } from "./context";
import { securityKey } from "./reinforcements";
import type { WorldStreamer } from "./streaming";

/** What a shooter is saved by: its key, or a reinforcement's (G-202); none for anyone else. */
const sourceKey = (e: Entity): string | undefined => e.key ?? (e.security ? securityKey(e.security) : undefined);

/**
 * The last shot at the player (G-901): the street takes her shot in the 3 s after it for
 * self-defence, the scanner for a fight, so a loaded game has to remember it too. The shooter
 * goes by its key, as the ids of a loaded game are others; one asleep with its chunk by its template's.
 */
export const threatSnapshot = (world: World<Entity>, streamer: WorldStreamer, session: SessionState): ThreatSnapshot | null => {
  const threat = session.lastThreat;
  if (!threat) return null;
  const shooter = world.entities.find((e) => e.id === threat.sourceId);
  const source = shooter ? sourceKey(shooter) : streamer.actorKeys.keyOf(threat.sourceId);
  return source === undefined ? { tick: threat.tick } : { tick: threat.tick, source };
};

/**
 * Brings back a save's last threat, after its entities: the shooter in the world, or the id it
 * wakes with. Nobody stands behind one the loaded game has not (id 0, which no entity takes), as
 * behind a shooter gone in a live game.
 */
export const restoreThreat = (world: World<Entity>, streamer: WorldStreamer, flags: readonly string[], session: SessionState, saved: ThreatSnapshot | undefined): void => {
  if (!saved) return;
  const key = saved.source;
  const id = key === undefined ? undefined : (world.entities.find((e) => sourceKey(e) === key)?.id ?? streamer.actorKeys.idOf(key, flags));
  session.lastThreat = { tick: saved.tick, sourceId: id ?? 0 };
};
