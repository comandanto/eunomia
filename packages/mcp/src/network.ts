import { homedir } from "node:os";
import { join } from "node:path";
import type { NetworkName } from "./format.js";

export interface NetworkConfig {
  name: NetworkName;
  passphrase: string;
  rpcUrl: string;
}

export const NETWORKS: Record<NetworkName, NetworkConfig> = {
  // No public mainnet RPC is assumed: the operator names one.
  pubnet: {
    name: "pubnet",
    passphrase: "Public Global Stellar Network ; September 2015",
    rpcUrl: "",
  },
};

/** Stellar mainnet, through the RPC in EUNOMIA_RPC_URL (required). EUNOMIA_NETWORK may be
 *  left out; set, it has to say pubnet — a config written for another network fails here
 *  rather than signing against the wrong one. */
export function resolveNetwork(env: NodeJS.ProcessEnv): NetworkConfig {
  const name = (env.EUNOMIA_NETWORK?.trim() || "pubnet") as NetworkName;
  const base = NETWORKS[name];
  if (!base) throw new Error(`Unknown EUNOMIA_NETWORK "${name}" — eunomia-mcp runs on pubnet only`);
  const rpcUrl = env.EUNOMIA_RPC_URL?.trim() || base.rpcUrl;
  if (!rpcUrl) throw new Error("EUNOMIA_RPC_URL is required — the Stellar mainnet RPC this agent talks to");
  return { ...base, rpcUrl };
}

/** Where credentials and caches live: EUNOMIA_HOME or ~/.eunomia. */
export const homeDir = (env: NodeJS.ProcessEnv): string =>
  env.EUNOMIA_HOME?.trim() || join(homedir(), ".eunomia");
