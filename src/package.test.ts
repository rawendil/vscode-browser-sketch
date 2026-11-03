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

test("images can be opened in a sketch from the Explorer and the image preview", () => {
  const command = "browserSketch.openImage";
  expect(pkg.contributes.commands.map((c: any) => c.command)).toContain(command);
  for (const menu of ["explorer/context", "editor/title"]) {
    expect(pkg.contributes.menus[menu].some((m: any) => m.command === command)).toBe(true);
  }
});

test("Ctrl+Alt+S has a single binding, the capture command decides between browser and image", () => {
  const bindings = pkg.contributes.keybindings.filter((k: any) => k.key === "ctrl+alt+s");
  expect(bindings.map((k: any) => k.command)).toEqual(["browserSketch.capture"]);
  expect(bindings[0].when).toBeUndefined();
});

test("the image preview button follows the tab's file, not focus", () => {
  const button = pkg.contributes.menus["editor/title"].find((m: any) => m.command === "browserSketch.openImage");
  expect(button.when).toMatch(/^resourceExtname =~/);
});

test("SVG files get the Explorer menu too", () => {
  const item = pkg.contributes.menus["explorer/context"].find((m: any) => m.command === "browserSketch.openImage");
  const re = new RegExp(item.when.match(/=~ \/(.*)\/i$/)[1], "i");
  expect(re.test(".svg")).toBe(true);
  expect(re.test(".txt")).toBe(false);
});
