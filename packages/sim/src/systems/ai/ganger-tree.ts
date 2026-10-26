/**
 * Ganger behaviour, as a mistreevous MDSL tree. Every action completes within the step it
 * runs in (no RUNNING state), so the tree holds no hidden state between steps and can be
 * rebuilt from components after a load.
 */
export const GANGER_TREE = `root {
  selector {
    sequence {
      condition [SeesPlayer]
      condition [PlayerInAttackRange]
      action [ShootAtPlayer]
    }
    sequence {
      condition [IsAlerted]
      condition [PlayerAlive]
      action [ChasePlayer]
    }
    action [HoldPosition]
  }
}`;
