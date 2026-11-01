import { DIFFICULTY_FIELDS, type DifficultyPresetId, type DifficultyProfile, type SaveSlotInfo, type SaveSnapshot, presetOf } from "@seki/core";
import type { Simulation } from "@seki/sim";
import type { DifficultyVm, SlotVm } from "@seki/ui";

/* The difficulty on screen (ADR-0066, stage 2): the pause menu's profile and the slots' labels. */

const same = (a: DifficultyProfile, b: DifficultyProfile): boolean => DIFFICULTY_FIELDS.every((f) => a[f] === b[f]);

/**
 * The running game's difficulty: the profile in force and the one waiting for the end of a
 * fight, which is no change when it equals the one in force. `current` is kept when nothing
 * changed, so the store does not re-render.
 */
export const difficultyView = (sim: Simulation, current: DifficultyVm): DifficultyVm => {
  const profile = sim.domain.difficulty;
  const asked = sim.session.pendingDifficulty;
  const pending = asked && !same(asked, profile) ? asked : null;
  const unchanged = same(current.profile, profile) && (current.pending === null ? pending === null : pending !== null && same(current.pending, pending));
  return unchanged ? current : { profile, pending };
};

type SlotPreset = DifficultyPresetId | "custom";

/**
 * The preset each slot was saved on, for its small label. The port's slot list does not carry
 * it, so the app remembers what it writes itself and reads a slot only when its label is new
 * to it (a save from before this session, or from another tab).
 */
export class SlotDifficulties {
  private readonly known = new Map<string, { readonly label: string; readonly preset: SlotPreset }>();

  /** A slot the app has just written or imported. */
  remember(slot: string, snapshot: SaveSnapshot): void {
    this.known.set(slot, { label: snapshot.meta.label, preset: presetOf(snapshot.domain.difficulty) });
  }

  /** The list with each slot's preset; an unreadable slot gets none. */
  async label(slots: readonly SaveSlotInfo[], load: (slot: string) => Promise<SaveSnapshot | null>): Promise<SlotVm[]> {
    const out: SlotVm[] = [];
    for (const info of slots) {
      let known = this.known.get(info.slot);
      if (known?.label !== info.savedAtLabel) {
        known = undefined;
        try {
          const snapshot = await load(info.slot);
          if (snapshot) this.remember(info.slot, snapshot);
          known = this.known.get(info.slot);
        } catch {
          // A corrupt slot says so in its objective; it has no difficulty to show.
        }
      }
      out.push(known ? { ...info, difficulty: known.preset } : info);
    }
    return out;
  }
}
