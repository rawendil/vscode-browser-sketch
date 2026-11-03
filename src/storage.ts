import { readdir, rm, stat } from "node:fs/promises";
import { extname, join } from "node:path";

/**
 * Removes screenshots older than `maxAgeMs`. The directory is shared by all windows,
 * so we leave fresh ones alone — another window may have them open. A missing directory is not an error.
 */
export async function cleanCaptures(dir: string, maxAgeMs: number, now = new Date()): Promise<void> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
  for (const name of names) {
    const file = join(dir, name);
    const { mtimeMs } = await stat(file);
    if (now.getTime() - mtimeMs >= maxAgeMs) await rm(file, { force: true });
  }
}

export function captureFileName(now: Date): string {
  return `screenshot-${now.toISOString().replace(/[:.]/g, "-")}.png`;
}

/** Name for a copy of an image opened from disk; the original stays untouched. */
export function importFileName(now: Date, source: string): string {
  return `image-${now.toISOString().replace(/[:.]/g, "-")}${extname(source).toLowerCase() || ".png"}`;
}
