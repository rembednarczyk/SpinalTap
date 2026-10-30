/**
 * ECS component types, split by domain (ADR-0031). This file only re-exports them, so every
 * import of `./components` stays as it was.
 */
export * from "./components/ai";
export * from "./components/body";
export * from "./components/devices";
export * from "./components/entity";
export * from "./components/interaction";
export * from "./components/movement";
export * from "./components/perks";
export * from "./components/schedule";
export * from "./components/vehicle";
