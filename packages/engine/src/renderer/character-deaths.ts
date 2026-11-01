import { type CharacterRig, animateRig, deathFinished, startDeath } from "./characters";

/**
 * Characters playing their death fall after the simulation removed them, a part behind
 * `CharacterViews`. A rig whose fall ended, or every one on `clear`, goes to `dispose`.
 */
export class CharacterDeaths {
  private readonly dying: CharacterRig[] = [];

  constructor(private readonly dispose: (rig: CharacterRig) => void) {}

  /** The rigs still falling, oldest first. */
  get rigs(): readonly CharacterRig[] {
    return this.dying;
  }

  fall(rig: CharacterRig): void {
    startDeath(rig);
    this.dying.push(rig);
  }

  /** Plays the falls; the finished ones go. */
  update(dt: number): void {
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const rig = this.dying[i];
      if (!rig) continue;
      animateRig(rig, 0, dt);
      if (deathFinished(rig)) {
        this.dispose(rig);
        this.dying.splice(i, 1);
      }
    }
  }

  /** Every falling rig goes at once. */
  clear(): void {
    for (const rig of this.dying.splice(0)) this.dispose(rig);
  }
}
