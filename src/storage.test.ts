import { existsSync } from "node:fs";
import { mkdir, mkdtemp, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { captureFileName, cleanCaptures, importFileName } from "./storage";

describe("cleanCaptures", () => {
  test("removes only files older than the limit (other windows may have fresh screenshots open)", async () => {
    const dir = join(await mkdtemp(join(tmpdir(), "bs-")), "captures");
    await mkdir(dir);
    const now = new Date("2026-11-03T12:00:00Z");
    await writeFile(join(dir, "stary.png"), "x");
    await utimes(join(dir, "stary.png"), new Date("2026-11-01T12:00:00Z"), new Date("2026-11-01T12:00:00Z"));
    await writeFile(join(dir, "swiezy.png"), "x");
    await utimes(join(dir, "swiezy.png"), new Date("2026-11-03T11:00:00Z"), new Date("2026-11-03T11:00:00Z"));
    await cleanCaptures(dir, 24 * 60 * 60 * 1000, now);
    expect(existsSync(join(dir, "stary.png"))).toBe(false);
    expect(existsSync(join(dir, "swiezy.png"))).toBe(true);
  });

  test("does not throw when the directory is missing", async () => {
    const dir = join(await mkdtemp(join(tmpdir(), "bs-")), "captures");
    await expect(cleanCaptures(dir, 1000)).resolves.toBeUndefined();
  });
});

test("captureFileName", () => {
  expect(captureFileName(new Date("2026-11-03T12:05:09.123Z"))).toBe("screenshot-2026-11-03T12-05-09-123Z.png");
});

describe("importFileName", () => {
  test("keeps the image extension, lowercased", () => {
    expect(importFileName(new Date("2026-11-03T12:05:09.123Z"), "/home/u/Pictures/Shot.JPG")).toBe(
      "image-2026-11-03T12-05-09-123Z.jpg",
    );
  });

  test("falls back to .png when the file has no extension", () => {
    expect(importFileName(new Date("2026-11-03T12:05:09.123Z"), "/home/u/shot")).toBe(
      "image-2026-11-03T12-05-09-123Z.png",
    );
  });
});
