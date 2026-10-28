/**
 * Ganger behaviour, as a mistreevous MDSL tree. Every action completes within the step it
 * runs in (no RUNNING state), so the tree holds no hidden state between steps and can be
 * rebuilt from components after a load.
 *
 * Only an alerted ganger fights. How a ganger becomes alerted depends on Hebi's stance
 * towards the player (see the ganger AI system); a ganger that sees the player without
 * being alerted just watches them. A ganger with a victim (a protection job's wave) goes for
 * that NPC before chasing anyone; without one, those two branches never match.
 *
 * ADR-0029: an alerted ganger that lost sight of the player chases the last known position,
 * not the player; once there it stops fighting and looks around (`HasLead`), as does one sent
 * to check a lead (a distraction, a camera, a trace, the heat), and then goes back to its post.
 */
export const GANGER_TREE = `root {
  selector {
    sequence {
      condition [IsAlerted]
      condition [SeesPlayer]
      condition [PlayerInAttackRange]
      action [ShootAtPlayer]
    }
    sequence {
      condition [HasVictim]
      condition [VictimInAttackRange]
      action [ShootAtVictim]
    }
    sequence {
      condition [HasVictim]
      action [ChaseVictim]
    }
    sequence {
      condition [IsAlerted]
      condition [PlayerAlive]
      action [ChasePlayer]
    }
    sequence {
      condition [SeesPlayer]
      action [WatchPlayer]
    }
    sequence {
      condition [HasLead]
      action [Investigate]
    }
    action [HoldPosition]
  }
}`;
