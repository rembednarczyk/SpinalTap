import { FACTIONS, type FactionId, formatClock } from "@seki/core";
import { type MessageKey, type Translate, translate } from "@seki/ui";
import type { Presenter } from "./context";

/** Landings from lower than this (a kerb, a stair) make no sound of their own; footsteps cover them. */
const LANDING_SOUND_DROP = 0.5;

const REFUSAL: Partial<Record<FactionId, MessageKey>> = { clinic: "world.refusal.clinic", civilians: "world.refusal.civilians" };

/** The world around the player: interactions, death, movement sounds, the camera, NPC reactions and time. */
export const presentWorld: Presenter = ({ bus, render, audio, ui, hooks, toast, isPlayer }) => {
  // A toast is written in the language of the moment it appears (ADR-0056).
  const t: Translate = (key, params) => translate(ui.getState().settings.locale, key, params);
  return [
    // Jumps and landings (ADR-0021): the player's own; a step off a kerb stays silent.
    bus.on("Jumped", (e) => {
      if (isPlayer(e.entityId)) audio.play("jump");
    }),
    // Hands and boots on the ledge edge: a light landing.
    bus.on("Mantled", (e) => {
      if (isPlayer(e.entityId)) audio.play("land");
    }),
    bus.on("Landed", (e) => {
      if (!isPlayer(e.entityId) || e.drop < LANDING_SOUND_DROP) return;
      audio.play(e.hard ? "land-hard" : "land");
    }),
    bus.on("PlayerDied", () => hooks.onPlayerDied()),
    bus.on("DialogueInterrupted", (e) => {
      hooks.onDialogueInterrupted(e.reason);
      toast("system", t("world.interrupted"), e.reason === "damage" ? t("world.underFire") : t("world.shotsNearby"));
    }),
    bus.on("InteractionStarted", (e) => {
      if (e.kind === "shop") hooks.onShop(e.shopId ?? "clinic", e.dialogueId);
      else if (e.kind === "loot") hooks.onLoot(e.dialogueId);
      else if (e.kind === "metro") hooks.onMetro?.(e.station ?? null);
      else hooks.onDialogue(e.dialogueId);
    }),
    bus.on("InteractionRefused", (e) => {
      const own = REFUSAL[e.faction];
      toast("reputation", own ? t(own) : t("world.refusal", { faction: FACTIONS[e.faction] }), t("world.reputation"));
      audio.play("denied");
    }),
    bus.on("NpcReacted", (e) => {
      if (e.reaction === "warn") toast("reputation", t("world.hebiWarn"), t("world.hebiLetPass"));
      else toast("reputation", t("world.fleeing"), t("world.afraid", { faction: FACTIONS[e.faction] }));
    }),
    bus.on("CameraModeChanged", (e) => render.setCameraMode(e.mode)),
    // A car held up by the player sounds its horn (ADR-0050).
    bus.on("VehicleHorned", () => audio.play("horn")),
    bus.on("TimeSkipped", (e) =>
      toast("system", t("world.timeSkipped", { clock: formatClock(e.clock) }), t("world.later", { hours: Math.floor(e.minutes / 60), minutes: e.minutes % 60 })),
    ),
  ];
};
