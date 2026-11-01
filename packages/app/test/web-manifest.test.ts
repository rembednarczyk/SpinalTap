import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** The game installs on a phone (gap audit, Technika): a manifest the page links, with real icons. */
const app = join(__dirname, "..");

describe("web app manifest", () => {
  const manifest = JSON.parse(readFileSync(join(app, "public/manifest.webmanifest"), "utf8")) as {
    name: string;
    start_url: string;
    scope: string;
    display: string;
    orientation: string;
    icons: { src: string; sizes: string; type: string }[];
  };

  it("opens the game fullscreen in landscape, relative to wherever it is served", () => {
    expect(manifest.name).toBe("Seki Senshi");
    expect(manifest.display).toBe("fullscreen");
    expect(manifest.orientation).toBe("landscape");
    // The build is served under a sub-path (vite base "./"): no absolute URLs.
    expect(manifest.start_url).toBe("./");
    expect(manifest.scope).toBe("./");
  });

  it("names PNG icons of 192 and 512 px that exist, with those sizes", () => {
    expect(manifest.icons.map((i) => i.sizes).sort()).toEqual(["192x192", "512x512"]);
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith("/")).toBe(false);
      const file = join(app, "public", icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      const png = readFileSync(file);
      // IHDR: width and height, big-endian, at bytes 16 and 20.
      const [w, h] = icon.sizes.split("x").map(Number);
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([w, h]);
    }
  });

  it("is linked from the page", () => {
    const html = readFileSync(join(app, "index.html"), "utf8");
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('name="theme-color"');
  });
});
