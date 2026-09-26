/**
 * Copies non-TypeScript runtime assets into dist/.
 *
 * tsc emits only what it compiles, so the inline email logo would be absent
 * from a production build and every message would go out without its mark. The
 * mailer degrades rather than crashing in that case, which means the problem
 * would be invisible until somebody looked at a real email.
 */
import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "src", "assets");
const to = join(root, "dist", "assets");

if (!existsSync(from)) {
  console.log("no src/assets to copy");
  process.exit(0);
}

await mkdir(to, { recursive: true });
await cp(from, to, { recursive: true });
console.log(`copied ${from} -> ${to}`);
