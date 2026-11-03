import { describe, expect, test } from "vitest";
import { firstVisibleImage, imageNameFromLabel, pickVisibleImage, type VisibleTab } from "./visible-image";

const image = (uri: string): VisibleTab<string> => ({ kind: "image", uri });
const browser: VisibleTab<string> = { kind: "unknown" };
const other: VisibleTab<string> = { kind: "other" };

describe("pickVisibleImage", () => {
  test("the focused image preview wins, even with a browser tab visible", () => {
    expect(pickVisibleImage(image("a.png"), [browser])).toBe("a.png");
  });

  test("a visible image counts when focus is in another panel (e.g. a chat) and no browser is visible", () => {
    expect(pickVisibleImage(other, [image("a.png"), other])).toBe("a.png");
  });

  test("a visible browser tab means a screenshot", () => {
    expect(pickVisibleImage(other, [image("a.png"), browser])).toBeUndefined();
    expect(pickVisibleImage(browser, [image("a.png")])).toBeUndefined();
  });

  test("no image on screen means a screenshot", () => {
    expect(pickVisibleImage(other, [other])).toBeUndefined();
    expect(pickVisibleImage(undefined, [])).toBeUndefined();
  });
});

describe("firstVisibleImage (the explicit Open Image command)", () => {
  test("takes a visible image even when focus is in a chat and a browser is visible", () => {
    expect(firstVisibleImage(other, [browser, image("a.png")])).toBe("a.png");
  });

  test("prefers the focused image", () => {
    expect(firstVisibleImage(image("b.png"), [image("a.png")])).toBe("b.png");
  });

  test("nothing on screen means asking for a file", () => {
    expect(firstVisibleImage(other, [browser])).toBeUndefined();
  });
});

describe("imageNameFromLabel (VS Code 1.144+ image preview tabs have no API input, only a label)", () => {
  test("an image file name is an image preview", () => {
    expect(imageNameFromLabel("sketch.png")).toBe("sketch.png");
    expect(imageNameFromLabel("Photo.JPEG")).toBe("Photo.JPEG");
    expect(imageNameFromLabel("icon.svg")).toBe("icon.svg");
  });

  test("a page title is not (that is the Integrated Browser)", () => {
    expect(imageNameFromLabel("Download Visual Studio Code - Mac, Linux, Windows")).toBeUndefined();
    expect(imageNameFromLabel("notes.txt")).toBeUndefined();
  });
});
