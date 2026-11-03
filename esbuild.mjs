import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");

const contexts = await Promise.all([
  esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    external: ["vscode"],
    outfile: "dist/extension.js",
    sourcemap: true,
    logLevel: "info",
  }),
  // Sketch editor page (webview) — dist/webview.js and dist/webview.css.
  esbuild.context({
    entryPoints: { webview: "src/sketch/webview/main.ts" },
    bundle: true,
    platform: "browser",
    format: "iife",
    target: "es2022",
    outdir: "dist",
    sourcemap: true,
    logLevel: "info",
  }),
]);

for (const ctx of contexts) {
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}
