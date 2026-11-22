// Neon Vault Heist — hand-in program for the make.fun best heist game bounty.
//
// What this program does, in order:
//   1. Copies the playable game (game/) into the output directory.
//   2. Copies the maker's screenshots (screenshots/) beside it.
//   3. Writes dossier.json there with the kit's buildDossier, so the sealed
//      scorer can rebuild the same dossier byte for byte and the judge can
//      read the screenshots plus an outline of the source.
//
// It runs on Node 22 with the standard library only, no network, and writes
// the same bytes on every run: the grader runs it twice and compares.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root: this file lives at the root, so its own directory is
// the root. Everything the entry ships is addressed from here.
const REPO_ROOT = fileURLToPath(new URL('.', import.meta.url));

// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (reference/gate.json). text_max_bytes shapes the
// dossier's bytes; the rest refuse an entry the scorer would refuse anyway:
// more than 4 screenshots, one over 256 KiB, more than 993 files in game/,
// more than 48 MiB of game files, or a path under game/ over 1000 bytes.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Copy one directory tree when it exists; the screenshots folder is optional
// during development, the game folder is not.
function copyTreeIfPresent(sourceName: string, targetName: string): void {
  const source = join(REPO_ROOT, sourceName);
  if (!existsSync(source)) return;
  cpSync(source, join(OUTPUT_DIR, targetName), { recursive: true });
}

function handIn(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  copyTreeIfPresent('game', 'game');
  mkdirSync(join(OUTPUT_DIR, 'screenshots'), { recursive: true });
  copyTreeIfPresent('screenshots', 'screenshots');

  // The dossier is built from the output directory itself, after both trees
  // are in place, so it describes exactly what the scorer will read.
  const dossier = buildDossier(OUTPUT_DIR, DOSSIER_CAPS);
  writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossier);
  console.log(`Neon Vault Heist handed in: ${dossier.length} dossier bytes.`);
}

handIn();
