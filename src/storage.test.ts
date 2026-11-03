import { existsSync } from "node:fs";
import { mkdir, mkdtemp, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { captureFileName, cleanCaptures } from "./storage";

describe("cleanCaptures", () => {
  test("usuwa tylko pliki starsze niż limit (inne okna mogą mieć otwarte świeże zrzuty)", async () => {
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

  test("nie rzuca, gdy katalogu nie ma", async () => {
    const dir = join(await mkdtemp(join(tmpdir(), "bs-")), "captures");
    await expect(cleanCaptures(dir, 1000)).resolves.toBeUndefined();
  });
});

test("captureFileName", () => {
  expect(captureFileName(new Date("2026-11-03T12:05:09.123Z"))).toBe("zrzut-2026-11-03T12-05-09-123Z.png");
});
