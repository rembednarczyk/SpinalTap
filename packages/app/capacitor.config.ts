import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The Android app (ADR-0079, stage 2): the `vite build` output inside a WebView, packed in the APK.
 * No `server.url`: the game is served from the files in the package, never from a remote server.
 * Orientation lives in the native project (`android/app/src/main/AndroidManifest.xml`), because
 * Capacitor has no setting for it; `test/capacitor-config.test.ts` checks it, the fullscreen and
 * the build directory against the web manifest and the Vite config.
 */
const config: CapacitorConfig = {
  appId: "pl.sekisenshi.game",
  appName: "Seki Senshi",
  // Vite's default `build.outDir`, relative to this package.
  webDir: "dist",
  backgroundColor: "#05080c",
  android: {
    // Every file comes from the package over https://localhost: no plain-HTTP content.
    allowMixedContent: false,
  },
  plugins: {
    // Fullscreen, as "display": "fullscreen" in the web manifest: the status and navigation bars
    // are hidden at start; a swipe from the edge shows them for a moment (Android 12+).
    SystemBars: { hidden: true },
  },
};

export default config;
