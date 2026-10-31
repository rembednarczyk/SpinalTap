import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/** `v0.1.0 · 1a2b3c4`: the version a player can read off the title screen and put in a bug report. */
const appVersion = (): string => {
  const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
  let commit = process.env.GITHUB_SHA?.slice(0, 7) ?? "";
  if (commit === "") {
    try {
      commit = execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch {
      // No git in this checkout (a source archive): the version alone.
    }
  }
  return commit === "" ? `v${version}` : `v${version} · ${commit}`;
};

export default defineConfig({
  plugins: [react()],
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 6000,
    sourcemap: false,
  },
  server: { port: 5173 },
  preview: { port: 4173, strictPort: true },
});
