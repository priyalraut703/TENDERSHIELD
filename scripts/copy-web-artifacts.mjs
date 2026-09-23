// Copies the compiled TenderShield circuit artifacts (ZKIR + proving/verifying
// keys) from managed/ into public/ so the browser can fetch them with
// FetchZkConfigProvider ({origin}/keys, {origin}/zkir).
// Mirrors the official Midnight leaderboard dev/build scripts.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const managed = path.join(root, 'managed', 'tendershield');
const publicDir = path.join(root, 'public');

for (const sub of ['keys', 'zkir']) {
  const src = path.join(managed, sub);
  const dest = path.join(publicDir, sub);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`copied ${src} -> ${dest}`);
}