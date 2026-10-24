// The Stellar network the app talks to: mainnet, and only mainnet.
//
// What is fixed about mainnet lives in the table below. What is ours to choose — the RPC the
// page talks to, the factory and registry we deployed — comes from the build's environment
// (vite.config.ts resolves it and injects the result), and the build refuses to start until
// each is set. The deposit caps are not here: they live in the factory, one per token, and
// the app reads them from the treasury it is looking at.
//
// Dependency-free on purpose: vite.config.ts imports this in Node to validate the target
// before anything is bundled, and the app reads the same table at runtime.

export type NetworkName = "pubnet";

export interface NetworkConfig {
  name: NetworkName;
  /** what the UI calls it */
  label: "Mainnet";
  passphrase: string;
  rpcUrl: string;
  horizonUrl: string;
  explorer: string;
  /** the native XLM Stellar Asset Contract */
  xlmSac: string;
  /** the USDC a treasury may hold, and the classic issuer a G… payee must trust to receive it */
  usdcSac: string;
  usdcIssuer: string;
  /** the treasury factory and registry this app creates and finds treasuries through */
  factoryId: string;
  registryId: string;
  /** any existing account: simulations need a source, and nothing is signed or sent from it */
  simulationSource: string;
}

/** Mainnet. The empty fields are not defaults: a build refuses to run until each is set from
 *  the environment (EUNOMIA_RPC_URL, EUNOMIA_FACTORY_ID, EUNOMIA_REGISTRY_ID), or here once
 *  the contracts are deployed. */
export const PUBNET: NetworkConfig = {
  name: "pubnet",
  label: "Mainnet",
  passphrase: "Public Global Stellar Network ; September 2015",
  // In a deployed build, this app's own https://<host>/api/rpc: the worker forwards to the
  // provider we pay for, whose URL carries a key and so never enters the bundle. Never a
  // public default either way — the RPC's simulation decides what the passkey is asked to
  // sign over, and its latest ledger sets when that signature expires.
  rpcUrl: "",
  horizonUrl: "https://horizon.stellar.org",
  explorer: "https://stellar.expert/explorer/public",
  xlmSac: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
  // Circle's USDC.
  usdcSac: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
  usdcIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  factoryId: "",
  registryId: "",
  // Circle's USDC issuer: an account that exists for as long as the USDC this app holds does.
  simulationSource: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
};

/** Settings for builds that never reach a chain — vitest — so the app's modules load with a
 *  complete table. Placeholders only: the RPC host cannot resolve, and the ids are well-formed
 *  but name nothing we deployed. */
export const STAND_IN_ENV: Record<string, string> = {
  EUNOMIA_RPC_URL: "https://rpc.stand-in.invalid",
  EUNOMIA_FACTORY_ID: "CBQHNAXSI55GX2GN6D67GK7BHVPSLJUGZQEU7WJ5LKR5PNUCGLIMAO4K",
  EUNOMIA_REGISTRY_ID: "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE",
};

const CONTRACT_ID = /^C[A-Z2-7]{55}$/;

/** The build's network from its environment. Throws, listing everything missing, rather than
 *  build a bundle with a hole in it. */
export function resolveNetwork(env: Record<string, string | undefined>): NetworkConfig {
  const pick = (k: string) => env[k]?.trim() || undefined;
  const net: NetworkConfig = {
    ...PUBNET,
    rpcUrl: pick("EUNOMIA_RPC_URL") ?? PUBNET.rpcUrl,
    factoryId: pick("EUNOMIA_FACTORY_ID") ?? PUBNET.factoryId,
    registryId: pick("EUNOMIA_REGISTRY_ID") ?? PUBNET.registryId,
  };

  const problems: string[] = [];
  if (!/^https:\/\/\S+$/.test(net.rpcUrl)) problems.push("EUNOMIA_RPC_URL: this deployment's https://…/api/rpc");
  // The SDF's test networks answer the same calls with a different passphrase: every
  // simulation would fail, and nothing on the page would say why.
  if (/testnet|futurenet/i.test(net.rpcUrl)) problems.push("EUNOMIA_RPC_URL: points at a test network");
  if (!CONTRACT_ID.test(net.factoryId)) problems.push("EUNOMIA_FACTORY_ID: the treasury factory (C…)");
  if (!CONTRACT_ID.test(net.registryId)) problems.push("EUNOMIA_REGISTRY_ID: the treasury registry (C…)");
  if (problems.length) {
    throw new Error(`Refusing a build with missing or wrong settings:\n  ${problems.join("\n  ")}`);
  }
  return net;
}
