import { existsSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { captureFileName, cleanCaptures } from "./storage";

describe("cleanCaptures", () => {
  test("usuwa katalog z plikami", async () => {
    const dir = join(await mkdtemp(join(tmpdir(), "bs-")), "captures");
    await mkdir(dir);
    await writeFile(join(dir, "zrzut.png"), "x");
    await cleanCaptures(dir);
    expect(existsSync(dir)).toBe(false);
  });

  test("nie rzuca, gdy katalogu nie ma", async () => {
    const dir = join(await mkdtemp(join(tmpdir(), "bs-")), "captures");
    await expect(cleanCaptures(dir)).resolves.toBeUndefined();
  });
});

test("captureFileName", () => {
  expect(captureFileName(new Date("2026-11-03T12:05:09.123Z"))).toBe("zrzut-2026-11-03T12-05-09-123Z.png");
});
