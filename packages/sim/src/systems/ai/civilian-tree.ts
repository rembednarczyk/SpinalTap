/**
 * Civilian behaviour. Like the ganger tree, every action finishes within its step, so the
 * decision is a pure function of positions and reputation and survives a load unchanged.
 */
export const CIVILIAN_TREE = `root {
  selector {
    sequence {
      condition [FearsPlayer]
      condition [PlayerNearby]
      action [FleeFromPlayer]
    }
    action [ReturnHome]
  }
}`;
