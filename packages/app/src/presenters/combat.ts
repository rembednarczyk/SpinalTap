import { patchUi } from "@seki/ui";
import type { Presenter } from "./context";

/** Combat: shots, weapons, melee, hits and kills, the sniper's laser and the overdrive. */
export const presentCombat: Presenter = ({ bus, render, audio, ui, isPlayer }) => [
  bus.on("ShotFired", (e) => {
    render.playEffect({ kind: "muzzle-flash", shooterId: e.shooterId, from: e.from, to: e.to });
    audio.play(isPlayer(e.shooterId) ? "shot" : "enemy-shot");
  }),
  bus.on("WeaponToggled", (e) => {
    render.playEffect({ kind: "weapon", entityId: e.entityId, drawn: e.drawn });
    if (isPlayer(e.entityId)) audio.play("ui-select");
  }),
  bus.on("WeaponSwitched", (e) => {
    render.playEffect({ kind: "weapon", entityId: e.entityId, drawn: true, slot: e.slot });
    if (isPlayer(e.entityId)) audio.play("weapon-switch");
  }),
  // Melee (ADR-0019): the swing plays over the simulation's timing; the whoosh comes as it lands.
  bus.on("MeleeSwing", (e) => render.playEffect({ kind: "melee", entityId: e.entityId, strike: e.strike, windup: e.windup, recovery: e.recovery })),
  bus.on("MeleeStrike", () => audio.play("swing")),
  bus.on("AttackBlocked", (e) => {
    render.playEffect({ kind: "block", entityId: e.defenderId, parried: e.parried, at: e.at });
    audio.play(e.parried ? "parry" : "block");
  }),
  bus.on("Staggered", (e) => render.playEffect({ kind: "stagger", entityId: e.entityId, duration: e.duration })),
  bus.on("ReloadStarted", (e) => {
    render.playEffect({ kind: "reload", entityId: e.entityId, duration: e.duration });
    if (isPlayer(e.entityId)) audio.play("reload");
  }),
  bus.on("DamageDealt", (e) => {
    render.playEffect({ kind: "hit-spark", at: e.at, critical: e.critical });
    render.playEffect({ kind: "flinch", entityId: e.targetId });
    if (isPlayer(e.targetId)) {
      patchUi(ui, { hurtFlash: ui.getState().hurtFlash + 1 });
      audio.play("hurt");
    } else if (isPlayer(e.sourceId)) {
      patchUi(ui, { hitMarker: ui.getState().hitMarker + 1, hitZone: e.zone, hitKind: e.critical ? "crit" : "hit" });
      audio.play(e.critical || e.zone === "head" ? "critical" : "hit");
    }
  }),
  bus.on("EntityKilled", () => audio.play("kill")),
  bus.on("AbilityActivated", () => {
    render.playEffect({ kind: "overdrive", active: true });
    audio.play("overdrive");
  }),
  bus.on("AbilityEnded", () => render.playEffect({ kind: "overdrive", active: false })),
  // The sniper's telegraph (ADR-0024): the laser is the warning.
  bus.on("SniperAimed", (e) => render.playEffect({ kind: "laser", shooterId: e.entityId, targetId: e.targetId, duration: e.duration })),
];
