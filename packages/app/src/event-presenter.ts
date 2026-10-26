import { type AudioPort, type DomainEvents, type EntityId, type EventBus, FACTIONS, type RenderPort } from "@seki/core";
import { type UiStore, dismissToast, patchUi, pushToast } from "@seki/ui";

const TOAST_MS = 4500;

export interface PresenterHooks {
  playerId(): EntityId | null;
  onDialogue(dialogueId: string): void;
  onPlayerDied(): void;
}

/**
 * Translates domain events into presentation: UI store updates and toasts, audio cues and
 * render effects. The only place where the three presentation channels meet.
 */
export const bindEventPresenter = (bus: EventBus<DomainEvents>, render: RenderPort, audio: AudioPort, ui: UiStore, hooks: PresenterHooks): (() => void) => {
  const toast = (kind: Parameters<typeof pushToast>[1]["kind"], title: string, text = "") => {
    const id = pushToast(ui, { kind, title, text });
    setTimeout(() => dismissToast(ui, id), TOAST_MS);
  };
  const isPlayer = (id: EntityId) => id === hooks.playerId();

  const offs = [
    bus.on("ShotFired", (e) => {
      render.playEffect({ kind: "muzzle-flash", shooterId: e.shooterId, from: e.from, to: e.to });
      audio.play(isPlayer(e.shooterId) ? "shot" : "enemy-shot");
    }),
    bus.on("DamageDealt", (e) => {
      render.playEffect({ kind: "hit-spark", at: e.at, critical: e.critical });
      if (isPlayer(e.targetId)) {
        patchUi(ui, { hurtFlash: ui.getState().hurtFlash + 1 });
        audio.play("hurt");
      } else if (isPlayer(e.sourceId)) {
        patchUi(ui, { hitMarker: ui.getState().hitMarker + 1 });
        audio.play(e.critical ? "critical" : "hit");
      }
    }),
    bus.on("EntityKilled", () => audio.play("kill")),
    bus.on("PlayerDied", () => hooks.onPlayerDied()),
    bus.on("InteractionFocusChanged", (e) => patchUi(ui, { prompt: e.prompt })),
    bus.on("InteractionStarted", (e) => hooks.onDialogue(e.dialogueId)),
    bus.on("CameraModeChanged", (e) => render.setCameraMode(e.mode)),
    bus.on("QuestAdvanced", (e) => {
      toast("quest", "Zadanie zaktualizowane", e.objective);
      audio.play("quest-update");
    }),
    bus.on("QuestCompleted", (e) => {
      toast("quest", "Zlecenie wykonane", e.title);
      audio.play("quest-update");
    }),
    bus.on("EddiesChanged", (e) => toast("money", `+${e.delta.toLocaleString("pl-PL")} €$`, "Przelew od Kaito")),
    bus.on("ReputationChanged", (e) => {
      if (e.delta !== 0) toast("reputation", `${FACTIONS[e.faction]} ${e.delta > 0 ? "+" : ""}${e.delta}`, "Reputacja");
    }),
    bus.on("MemoryUnlocked", (e) => {
      toast("memory", e.title, e.description);
      render.playEffect({ kind: "memory-glitch" });
      audio.play("memory");
    }),
  ];
  return () => {
    for (const off of offs) off();
  };
};
