/**
 * The keys of a micro-event's people (ADR-0029 street events): never saved, never left asleep
 * (G-230). On its own so that streaming can tell them without importing the events themselves.
 */
export const isMicroKey = (key: string): boolean => key.startsWith("micro:");
