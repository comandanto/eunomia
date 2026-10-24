// Eunomia — app configuration. Holds no secrets: everything here is public, and every
// network value comes from the table the build was made with (see networks.ts).
import type { NetworkConfig } from "./networks";

// Injected by vite.config.ts (build-env.d.ts).
const NET: NetworkConfig = __EUNOMIA_NET__;

export const NETWORK_LABEL = NET.label;
export const NETWORK_PASSPHRASE = NET.passphrase;
export const RPC_URL = NET.rpcUrl;
export const HORIZON_URL = NET.horizonUrl;
export const EXPLORER = NET.explorer;

/** The native XLM SAC — the token an XLM treasury holds and spends. */
export const XLM_SAC = NET.xlmSac;
/** The USDC SAC a USDC treasury holds, and its classic issuer. */
export const USDC_TOKEN = NET.usdcSac;
export const USDC_ISSUER = NET.usdcIssuer;

/** The treasury factory: one owner signature deploys a treasury with its policy, payees,
 *  Leash, funding and registry entry. It also holds the deposit cap of each token it
 *  accepts; a treasury carries its own copy, which is what the app reads. */
export const FACTORY_ID = NET.factoryId;

// Eunomia Treasury Registry — permissionless wallet → treasury discovery index,
// used for cross-device recovery of per-user treasuries.
export const REGISTRY_ID = NET.registryId;

/** Source account for read-only simulations. Nothing is ever signed or sent from it. */
export const SIMULATION_SOURCE = NET.simulationSource;

/** The contracts the landing footer lists for anyone who wants to check the chain. */
export const LISTED_CONTRACTS: { label: string; id: string }[] = [
  { label: "Treasury factory", id: NET.factoryId },
  { label: "Treasury registry", id: NET.registryId },
];

// --- Passkey (smart wallet) --------------------------------------------------------
// The smart-wallet WASM passkey-kit deploys for each new passkey user.
export const WALLET_WASM_HASH =
  "fdefad64b96837147e1c333e51f537b696eab925e9f147e63d597c04e3c903f0";
// WebAuthn Relying Party id. A passkey is bound to this domain: change it and every passkey
// created before the change stops resolving. Left undefined in dev so the kit falls back to
// the current origin (localhost), which is the only value that works there.
// Read defensively: import.meta.env does not exist outside Vite.
const IS_PROD = (import.meta as { env?: { PROD?: boolean } }).env?.PROD === true;
export const RP_ID: string | undefined = IS_PROD ? "eunomia.finance" : undefined;

export const USDC_UNIT = 10_000_000n; // 1 USDC (7 decimals)

export function fmtUSDC(stroops: bigint, maxFrac = 2): string {
  const neg = stroops < 0n;
  const v = neg ? -stroops : stroops;
  const whole = v / USDC_UNIT;
  const frac = v % USDC_UNIT;
  const fracStr = frac.toString().padStart(7, "0").slice(0, maxFrac).replace(/0+$/, "");
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + wholeStr + (fracStr ? "." + fracStr : "");
}

/** XLM and USDC are both 7-decimal; fmtUSDC is pure math, so reuse it and label XLM. */
export const fmtXlm = (stroops: bigint) => fmtUSDC(stroops, 4);

export function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

export function txUrl(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function contractUrl(id: string): string {
  return `${EXPLORER}/contract/${id}`;
}
