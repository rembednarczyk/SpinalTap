/**
 * Civilian behaviour. Like the ganger tree, every action finishes within its step, so the
 * decision is a pure function of positions, reputation and the crowd state (ADR-0029).
 * Fear comes first: cowering by a close shot, running from a disturbance, watching one,
 * then keeping away from a player the street fears, then the daily plan.
 */
export const CIVILIAN_TREE = `root {
  selector {
    sequence {
      condition [IsCowering]
      action [Cower]
    }
    sequence {
      condition [IsFleeing]
      action [FleeFromDanger]
    }
    sequence {
      condition [IsAlarmed]
      action [WatchDanger]
    }
    sequence {
      condition [FearsPlayer]
      condition [PlayerNearby]
      action [FleeFromPlayer]
    }
    action [ReturnHome]
  }
}`;
