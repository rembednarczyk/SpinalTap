import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import capacitor from "../capacitor.config";
import vite from "../vite.config";

/** The APK (ADR-0079, stage 2) is the web build in a WebView: same files, same screen as the manifest. */
const app = join(__dirname, "..");
const manifest = JSON.parse(readFileSync(join(app, "public/manifest.webmanifest"), "utf8")) as {
  name: string;
  display: string;
  orientation: string;
};
const android = (file: string): string => readFileSync(join(app, "android", file), "utf8");

describe("capacitor config", () => {
  it("packs the directory vite builds into, and serves it from the package, not a server", () => {
    const viteConfig = vite as { build?: { outDir?: string } };
    // Vite's default outDir is dist; a changed outDir has to change webDir too.
    expect(capacitor.webDir).toBe(viteConfig.build?.outDir ?? "dist");
    expect(capacitor.server?.url).toBeUndefined();
    expect(capacitor.android?.allowMixedContent).toBe(false);
  });

  it("names the app as the manifest does, with the same id in the native project", () => {
    expect(capacitor.appName).toBe(manifest.name);
    expect(android("app/build.gradle")).toContain(`applicationId "${capacitor.appId}"`);
    expect(android("app/src/main/res/values/strings.xml")).toContain(`<string name="app_name">${manifest.name}</string>`);
  });

  it("opens fullscreen in landscape, as the manifest asks", () => {
    expect(manifest.display).toBe("fullscreen");
    expect(capacitor.plugins?.SystemBars).toMatchObject({ hidden: true });
    expect(manifest.orientation).toBe("landscape");
    // Either way up, like a landscape web app; the one activity of the app.
    const orientations = [...android("app/src/main/AndroidManifest.xml").matchAll(/android:screenOrientation="(\w+)"/g)].map((m) => m[1]);
    expect(orientations).toEqual(["sensorLandscape"]);
  });

  it("signs a release only with a key from the environment", () => {
    const gradle = android("app/build.gradle");
    expect(gradle).toContain('System.getenv("ANDROID_KEYSTORE_PATH")');
    expect(gradle).not.toMatch(/storePassword\s+["']/);
    expect(gradle).not.toMatch(/keyPassword\s+["']/);
  });
});
