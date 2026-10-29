/**
 * Entry point: the game, or with `?lublin-preview` the map city preview on its own (ADR-0044).
 * Each is its own chunk, so neither loads the other.
 */
if (new URLSearchParams(location.search).has("lublin-preview")) void import("./lublin-preview/preview-main");
else void import("./main");

export {};
