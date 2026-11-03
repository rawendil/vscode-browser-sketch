import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("the macOS shortcut does not override Save All (cmd+alt+s)", () => {
  const binding = pkg.contributes.keybindings.find((k: any) => k.command === "browserSketch.capture");
  expect(binding.mac).not.toBe("cmd+alt+s");
});

test("activates after startup so the status bar icon shows without a first capture", () => {
  expect(pkg.activationEvents).toContain("onStartupFinished");
});
