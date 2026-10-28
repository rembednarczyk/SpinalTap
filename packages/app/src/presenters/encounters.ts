import type { Presenter } from "./context";

/**
 * Street encounters (ADR-0032): the scene opens the usual way a conversation does, through the
 * dialogue hook, so ink, choices and `end-dialogue` work as with any NPC. The session skips an
 * encounter that starts while a panel is already on screen.
 */
export const presentEncounters: Presenter = ({ bus, hooks }) => [bus.on("EncounterStarted", (e) => hooks.onEncounter?.(e.knot, e.npcId))];
