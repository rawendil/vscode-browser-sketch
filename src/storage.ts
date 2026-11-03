import { rm } from "node:fs/promises";

/** Usuwa katalog zrzutów razem z zawartością; brak katalogu to nie błąd. */
export async function cleanCaptures(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

export function captureFileName(now: Date): string {
  return `zrzut-${now.toISOString().replace(/[:.]/g, "-")}.png`;
}
