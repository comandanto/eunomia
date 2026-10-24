// Build gate: nothing that can sign may ship in the bundle.
//
// It reads what was actually produced, runs as part of every build, and fails the build
// rather than warning. The policy it encodes, which is the one the project actually holds:
//
//   * the bundle carries no secret seed at all — every signer is a wallet, a passkey, or the
//     agent's own key on its own machine;
//   * no trace of the retired testnet demo (its agent and treasury addresses), and nothing
//     that talks to a test network;
//   * no test-signer bypass: if its global survives into the bundle it is reachable or
//     near-reachable code, and ready-made material for a "paste this in your console" script.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const DIST = new URL("../dist/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const SECRET_SEED = /S[A-Z2-7]{55}/g;
const TEST_SIGNER = /__EUNOMIA_TEST_SIGNER__/g;

// What the bundle must not contain even with every seed gone: the retired demo's addresses
// (proof its code did not come back under another name) and the test-network endpoints
// (proof nothing in the app still talks to the wrong network).
const FORBIDDEN = [
  ["the retired demo agent's address", "GDAOXABLEOFZP2M4PRM7N6YKOKXWMPFOSLU35WL5ZQY4PQFHF3VCIDS6"],
  ["the retired demo treasury", "CAYWNXHANRY5GSJAZOR4YTKBKNOKTCITE52ZRKDKCAWLDTYWFFVFSPAZ"],
  ["the retired demo funding pool", "GD2NZKSMQW367OIFXRM4NP7RIW6YLDZLJ4C7253MDOKCFC4Q4IOO3427"],
  ["the testnet RPC", "soroban-testnet.stellar.org"],
  ["testnet Horizon", "horizon-testnet.stellar.org"],
  ["friendbot", "friendbot.stellar.org"],
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(js|mjs|cjs|html|css|map)$/.test(entry)) out.push(p);
  }
  return out;
}

// The network comes from the build itself (vite.config.ts writes it beside the bundle from the
// same resolved config that was compiled in), never from a guess. Searching the bundle for a
// passphrase looks reasonable and is wrong: stellar-sdk ships every network's passphrase in its
// own `Networks` constant.
const INFO = join(DIST, "build-info.json");
if (!existsSync(INFO)) {
  console.error("check:no-secrets — dist/build-info.json is missing; cannot tell which network this bundle targets");
  process.exit(1);
}
const { network } = JSON.parse(readFileSync(INFO, "utf8"));
if (network !== "pubnet") {
  console.error(`check:no-secrets — dist/build-info.json says "${network}"; the app ships for pubnet only`);
  process.exit(1);
}

const files = walk(DIST).map((path) => ({ path, body: readFileSync(path, "utf8") }));
const problems = [];

for (const { path, body } of files) {
  const where = path.replace(DIST, "dist/");

  for (const seed of body.match(SECRET_SEED) ?? []) {
    problems.push(`${where}: a secret seed "${seed.slice(0, 12)}…" reached the bundle`);
  }

  for (const [what, needle] of FORBIDDEN) {
    if (body.includes(needle)) problems.push(`${where}: the bundle contains ${what}`);
  }

  if (TEST_SIGNER.test(body)) {
    problems.push(`${where}: a test-signer global reached the bundle — a wallet bypass in published code`);
    TEST_SIGNER.lastIndex = 0;
  }
}

if (problems.length) {
  console.error("\nBuild refused — check:no-secrets\n");
  for (const p of problems) console.error(`  ${p}`);
  console.error("\nMove signing server-side (the relay is the pattern) before shipping.\n");
  process.exit(1);
}

console.log(`check:no-secrets — ${files.length} built assets clean (no keys, no demo, no test-network endpoints)`);
