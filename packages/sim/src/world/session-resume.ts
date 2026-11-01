import type { DomainState } from "@seki/core";
import { interiorAt } from "../content/interior-areas";
import { wholeRam } from "../systems/scanner-system";
import type { Entity } from "./components";
import type { SessionState } from "./context";
import type { WorldStreamer } from "./streaming";

/**
 * What the session took note of at the end of the saved step, read back from the loaded state
 * (G-174): the district, the player's health, the whole RAM and the interior all follow from
 * what the save holds, so they are not saved. Without them the first step after a load only took
 * note (no damage counted for the contract's badge, no offer or encounter on entering a
 * district, no interior event) where the saved game would have acted. A rider of the metro is out
 * of the world and its notes wait for the platform, as in a game never saved.
 */
export const resumeSession = (session: SessionState, domain: DomainState, player: Entity | undefined, streamer: WorldStreamer): void => {
  if (!player || domain.metro.ride !== null) return;
  const district = streamer.districtAt(player.position);
  session.watch.playerHp = player.health?.current ?? null;
  session.watch.district = district;
  session.watch.ram = wholeRam(domain);
  session.street2.district = district;
  session.interior = interiorAt(player.position)?.id ?? null;
};
