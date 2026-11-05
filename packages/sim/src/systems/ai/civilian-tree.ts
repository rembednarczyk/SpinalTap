/**
 * Civilian behaviour. Like the ganger tree, every action finishes within its step, so the
 * decision is a pure function of positions, reputation and the crowd state (ADR-0029).
 * Fear comes first: cowering by a close shot, running from a disturbance, watching one,
 * then keeping away from a player the street fears (passers-by run from a hostile street and
 * make way on a wary one, standing past the radius while their spot is close to the player,
 * ADR-0070), then the daily plan; a resident with a shop or a talk keeps to it and only turns
 * to face a player the street is hostile to.
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
    sequence {
      condition [FearsPlayer]
      condition [SpotNearPlayer]
      action [WatchPlayer]
    }
    sequence {
      condition [ResentsPlayer]
      action [StayFacingPlayer]
    }
    action [ReturnHome]
  }
}`;
