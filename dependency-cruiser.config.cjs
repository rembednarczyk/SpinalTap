/**
 * Architecture guard (plan §3, ADR-0001). Dependencies point inwards towards the domain:
 *   core ← sim ← engine
 *   core ← narrative, persistence, ui
 *   app  → everything (composition root)
 */
const pkg = (name) => `^packages/${name}/`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
    {
      name: "not-to-unresolvable",
      comment: "Also catches imports of workspace packages a package did not declare (pnpm keeps them unresolvable).",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
    { name: "no-undeclared-deps", severity: "error", from: {}, to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] } },
    {
      name: "core-is-pure",
      comment: "core must not depend on any other package, Babylon, React or browser storage.",
      severity: "error",
      from: { path: pkg("core") },
      to: { path: ["^packages/(?!core/)", "@babylonjs", "react", "zustand", "inkjs", "idb", "miniplex", "mistreevous"] },
    },
    {
      name: "sim-only-core",
      severity: "error",
      from: { path: pkg("sim") },
      to: { path: ["^packages/(engine|ui|narrative|persistence|app)/", "@babylonjs", "react", "zustand", "inkjs", "idb"] },
    },
    {
      name: "engine-no-ui-app",
      severity: "error",
      from: { path: pkg("engine") },
      to: { path: ["^packages/(ui|narrative|persistence|app)/", "react", "zustand"] },
    },
    {
      name: "ui-no-engine",
      comment: "UI reads the store and raises intents; it never touches the renderer or the simulation.",
      severity: "error",
      from: { path: pkg("ui") },
      to: { path: ["^packages/(engine|sim|narrative|persistence|app)/", "@babylonjs"] },
    },
    {
      name: "narrative-only-core",
      severity: "error",
      from: { path: pkg("narrative") },
      to: { path: ["^packages/(engine|sim|ui|persistence|app)/", "@babylonjs", "react"] },
    },
    {
      name: "persistence-only-core",
      severity: "error",
      from: { path: pkg("persistence") },
      to: { path: ["^packages/(engine|sim|ui|narrative|app)/", "@babylonjs", "react"] },
    },
    {
      name: "babylon-behind-one-module",
      comment: "Only engine/src/babylon.ts imports Babylon (keeps tree-shaking and the adapter boundary explicit).",
      severity: "error",
      from: { path: "^packages/", pathNot: "^packages/engine/src/babylon\\.ts$" },
      to: { path: "@babylonjs" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: ["/dist/", "/test/", "\\.test\\.tsx?$", "vite\\.config\\.ts$"] },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    preserveSymlinks: false,
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "default"], extensions: [".ts", ".tsx", ".js"] },
    tsConfig: { fileName: "tsconfig.depcruise.json" },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
