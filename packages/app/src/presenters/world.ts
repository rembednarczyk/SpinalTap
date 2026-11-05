import { FACTIONS, formatClock } from "@seki/core";
import { type Translate, translate } from "@seki/ui";
import type { Presenter } from "./context";

/** Landings from lower than this (a kerb, a stair) make no sound of their own; footsteps cover them. */
const LANDING_SOUND_DROP = 0.5;

/**
 * After a reaction toast (passers-by run, the gang warns) has gone, the same reaction stays
 * quiet this long (s of play): in a crowd that fears the player every passer-by reacts, and one
 * toast says it for all of them (G-281). While the toast is up, the others are counted on it.
 */
const REACTION_GAP = 30;

/** The world around the player: interactions, death, movement sounds, the camera, NPC reactions and time. */
export const presentWorld: Presenter = ({ bus, render, audio, ui, hooks, toast, isPlayer }) => {
  // A toast is written in the language of the moment it appears (ADR-0056).
  const t: Translate = (key, params) => translate(ui.getState().settings.locale, key, params);
  const reacted = new Map<string, { at: number; id: number }>();
  const reactionToast = (key: string, title: string, text: string) => {
    const now = hooks.playSeconds?.() ?? 0;
    const last = reacted.get(key);
    const onScreen = last !== undefined && ui.getState().toasts.some((x) => x.id === last.id);
    // A load can take the clock back: the gap then counts from the load on.
    const quiet = hooks.playSeconds !== undefined && last !== undefined && now >= last.at && now - last.at < REACTION_GAP;
    if (!onScreen && quiet) return;
    reacted.set(key, { at: onScreen ? last.at : now, id: toast("reputation", title, text) });
  };
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
    bus.on("NpcReacted", (e) => {
      const key = `${e.reaction}:${e.faction}`;
      if (e.reaction === "warn") reactionToast(key, t("world.hebiWarn"), t("world.hebiLetPass"));
      else reactionToast(key, t("world.fleeing"), t("world.afraid", { faction: t(FACTIONS[e.faction]) }));
    }),
    bus.on("CameraModeChanged", (e) => render.setCameraMode(e.mode)),
    // A car held up by the player sounds its horn (ADR-0050).
    bus.on("VehicleHorned", () => audio.play("horn")),
    bus.on("TimeSkipped", (e) =>
      toast("system", t("world.timeSkipped", { clock: formatClock(e.clock) }), t("world.later", { hours: Math.floor(e.minutes / 60), minutes: e.minutes % 60 })),
    ),
  ];
};
