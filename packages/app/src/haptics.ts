import type { DomainEvents, EntityId, EventBus } from "@seki/core";

/**
 * Haptics on a phone (the user's ask of 18.11): short buzzes for the player's shots, the hits it
 * takes, the kills it makes, a hard landing and its death. A channel of its own beside the event
 * presenter (whose presenters keep one handler per event); off in the settings, or without a
 * vibration motor, nothing happens. Durations in milliseconds, a list alternating buzz and pause.
 */
export interface Haptics {
  pulse(pattern: number | readonly number[]): void;
}

/** The buzzes, light to heavy. */
export const HAPTIC = {
  shot: 10,
  hurt: 35,
  hurtCritical: 60,
  kill: [20, 40, 30],
  landing: 50,
  death: [80, 60, 160],
} as const;

/** The Web Vibration API (Android's WebView with the VIBRATE permission); null where there is none. */
export const webHaptics = (nav: { vibrate?: (pattern: number | number[]) => boolean } | undefined = globalThis.navigator): Haptics | null => {
  if (!nav || typeof nav.vibrate !== "function") return null;
  const vibrate = nav.vibrate.bind(nav);
  return {
    pulse: (pattern) => {
      try {
        vibrate(typeof pattern === "number" ? pattern : [...pattern]);
      } catch {
        // A blocked or busy motor is no error of the game.
      }
    },
  };
};

/** Buzzes for the player's events while `enabled` says so; returns the unsubscribe. */
export const bindHaptics = (bus: EventBus<DomainEvents>, haptics: Haptics, playerId: () => EntityId | null, enabled: () => boolean): (() => void) => {
  const mine = (id: EntityId | null | undefined) => id !== null && id !== undefined && id === playerId();
  const pulse = (p: number | readonly number[]) => {
    if (enabled()) haptics.pulse(p);
  };
  const offs = [
    bus.on("ShotFired", (e) => mine(e.shooterId) && pulse(HAPTIC.shot)),
    bus.on("DamageDealt", (e) => mine(e.targetId) && e.amount > 0 && pulse(e.critical ? HAPTIC.hurtCritical : HAPTIC.hurt)),
    bus.on("EntityKilled", (e) => mine(e.killerId) && !mine(e.entityId) && pulse(HAPTIC.kill)),
    bus.on("Landed", (e) => mine(e.entityId) && e.hard && pulse(HAPTIC.landing)),
    bus.on("PlayerDied", () => pulse(HAPTIC.death)),
  ];
  return () => {
    for (const off of offs) off();
  };
};
