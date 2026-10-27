import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 6000,
    sourcemap: false,
  },
  server: { port: 5173 },
  preview: { port: 4173, strictPort: true },
});
