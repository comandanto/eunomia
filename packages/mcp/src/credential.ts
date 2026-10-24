// The agent's credential: an Ed25519 key the agent generates locally and the treasury
// owner authorises with set_session (the "Leash"). The secret never leaves this machine;
// the owner only ever sees the public key. Bounded by design — cap + expiry + instant
// revoke — so a leaked file is survivable, which is also why it is plain JSON at 0600.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import type { NetworkName } from "./format.js";

export interface Credential {
  version: 1;
  network: NetworkName;
  treasuryId: string;
  agentPublicKey: string;
  agentSecret: string;
  /** ISO timestamp, or "env" when the secret came from EUNOMIA_AGENT_SECRET */
  createdAt: string;
}

export const isValidContractId = (id: string): boolean => StrKey.isValidContract(id);

export const credentialPath = (home: string, network: NetworkName, treasuryId: string): string =>
  join(home, network, `${treasuryId}.json`);

export function createCredential(network: NetworkName, treasuryId: string, now = new Date()): Credential {
  if (!isValidContractId(treasuryId)) {
    throw new Error(`"${treasuryId}" is not a Stellar contract id (C…, 56 characters)`);
  }
  const kp = Keypair.random();
  return {
    version: 1,
    network,
    treasuryId,
    agentPublicKey: kp.publicKey(),
    agentSecret: kp.secret(),
    createdAt: now.toISOString(),
  };
}

export function saveCredential(home: string, c: Credential, opts: { force?: boolean } = {}): string {
  const p = credentialPath(home, c.network, c.treasuryId);
  if (existsSync(p) && !opts.force) {
    throw new Error(
      `A credential for this treasury already exists at ${p} — pass --force to replace it (the owner must then start a new Leash for the new key).`,
    );
  }
  mkdirSync(dirname(p), { recursive: true, mode: 0o700 });
  writeFileSync(p, JSON.stringify(c, null, 2), { mode: 0o600 });
  // `mode` applies only when the file is created: a --force overwrite kept whatever the old
  // file allowed (review L7). Windows ignores POSIX modes; there the user profile's ACL is
  // what protects the file.
  chmodSync(p, 0o600);
  return p;
}

export function loadCredential(home: string, network: NetworkName, treasuryId: string): Credential | null {
  const p = credentialPath(home, network, treasuryId);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as Credential;
}

/** EUNOMIA_AGENT_SECRET wins (CI / containers); otherwise the file `init` wrote. */
export function resolveCredential(
  env: NodeJS.ProcessEnv,
  home: string,
  network: NetworkName,
  treasuryId: string,
): Credential | null {
  const secret = env.EUNOMIA_AGENT_SECRET?.trim();
  if (secret) {
    let kp: Keypair;
    try {
      kp = Keypair.fromSecret(secret);
    } catch {
      throw new Error("EUNOMIA_AGENT_SECRET is not a Stellar secret key (S…, 56 characters)");
    }
    return { version: 1, network, treasuryId, agentPublicKey: kp.publicKey(), agentSecret: secret, createdAt: "env" };
  }
  return loadCredential(home, network, treasuryId);
}
