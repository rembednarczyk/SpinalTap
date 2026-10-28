import { FACTIONS, type FactionId, formatClock } from "@seki/core";
import { patchUi } from "@seki/ui";
import type { Presenter } from "./context";

/** Landings from lower than this (a kerb, a stair) make no sound of their own; footsteps cover them. */
const LANDING_SOUND_DROP = 0.5;

const REFUSAL: Partial<Record<FactionId, string>> = { clinic: "Mori zamyka drzwi kliniki", civilians: "Oyaji opuszcza roletę" };

/** The world around the player: interactions, death, movement sounds, the camera, NPC reactions and time. */
export const presentWorld: Presenter = ({ bus, render, audio, ui, hooks, toast, isPlayer }) => [
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
    toast("system", "Rozmowa przerwana", e.reason === "damage" ? "Ktoś do ciebie strzela!" : "Strzały tuż obok. Nie czas na gadanie.");
  }),
  bus.on("InteractionFocusChanged", (e) => patchUi(ui, { prompt: e.prompt })),
  bus.on("InteractionStarted", (e) => {
    if (e.kind === "shop") hooks.onShop(e.shopId ?? "clinic", e.dialogueId);
    else if (e.kind === "loot") hooks.onLoot(e.dialogueId);
    else hooks.onDialogue(e.dialogueId);
  }),
  bus.on("InteractionRefused", (e) => {
    toast("reputation", REFUSAL[e.faction] ?? `${FACTIONS[e.faction]} nie chce z tobą rozmawiać`, "Reputacja");
    audio.play("denied");
  }),
  bus.on("NpcReacted", (e) => {
    if (e.reaction === "warn") toast("reputation", "Hebi: „Idź swoją drogą, Seki.”", "Gangerzy cię przepuszczają");
    else toast("reputation", "Przechodnie uciekają", `${FACTIONS[e.faction]} boją się ciebie`);
  }),
  bus.on("CameraModeChanged", (e) => render.setCameraMode(e.mode)),
  bus.on("TimeSkipped", (e) => toast("system", `Mija czas: ${formatClock(e.clock)}`, `${Math.floor(e.minutes / 60)} h ${e.minutes % 60} min później`)),
];
