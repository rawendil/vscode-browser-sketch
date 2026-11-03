import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

/**
 * Usuwa zrzuty starsze niż `maxAgeMs`. Katalog jest wspólny dla wszystkich okien,
 * więc świeżych nie ruszamy — inne okno może je mieć otwarte. Brak katalogu to nie błąd.
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
