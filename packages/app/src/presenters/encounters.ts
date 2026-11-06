import type { Presenter } from "./context";

/**
 * Street encounters (ADR-0032): the scene opens the usual way a conversation does, through the
 * dialogue hook, so ink, choices and `end-dialogue` work as with any NPC. The session skips an
 * encounter that starts while a panel is already on screen. A micro-event (ADR-0034) shares the
 * event but has no knot: it is played in the world, and an empty conversation would only take the
 * controls away (G-401).
 */
export const presentEncounters: Presenter = ({ bus, hooks }) => [
  bus.on("EncounterStarted", (e) => {
    if (e.knot) hooks.onEncounter?.(e.knot, e.npcId);
  }),
];
