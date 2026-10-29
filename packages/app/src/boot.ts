/**
 * Entry point: the game, or with `?lublin-preview` the map city preview on its own (ADR-0044),
 * also with `?props-gallery`, its gallery of street furniture (ADR-0047). Each is its own chunk,
 * so neither loads the other.
 */
const params = new URLSearchParams(location.search);
if (params.has("lublin-preview") || params.has("props-gallery")) void import("./lublin-preview/preview-main");
else void import("./main");

export {};
