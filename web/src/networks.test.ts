import { describe, expect, it } from "vitest";
import { Asset, Networks } from "@stellar/stellar-sdk";
import { PUBNET, STAND_IN_ENV, resolveNetwork } from "./networks";

const FACTORY = "CBQHNAXSI55GX2GN6D67GK7BHVPSLJUGZQEU7WJ5LKR5PNUCGLIMAO4K";
const REGISTRY = "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE";
const MAINNET = {
  EUNOMIA_RPC_URL: "https://rpc.example.com",
  EUNOMIA_FACTORY_ID: FACTORY,
  EUNOMIA_REGISTRY_ID: REGISTRY,
};

describe("the network table", () => {
  it("pins each SAC to what its asset derives on mainnet", () => {
    // A wrong id here is a treasury created over a token nobody holds.
    expect(Asset.native().contractId(Networks.PUBLIC)).toBe(PUBNET.xlmSac);
    expect(new Asset("USDC", PUBNET.usdcIssuer).contractId(Networks.PUBLIC)).toBe(PUBNET.usdcSac);
  });

  it("carries the passphrase the SDK knows mainnet by", () => {
    expect(PUBNET.passphrase).toBe(Networks.PUBLIC);
  });
});

describe("resolveNetwork", () => {
  it("refuses a build without the RPC, which depends on the host it is for", () => {
    expect(() => resolveNetwork({})).toThrow(/EUNOMIA_RPC_URL/);
  });

  it("builds against the deployed factory and registry unless told otherwise", () => {
    const net = resolveNetwork({ EUNOMIA_RPC_URL: "https://app.example.com/api/rpc" });
    expect(net.factoryId).toBe(PUBNET.factoryId);
    expect(net.registryId).toBe(PUBNET.registryId);
    expect(PUBNET.factoryId).toMatch(/^C[A-Z2-7]{55}$/);
    expect(PUBNET.registryId).toMatch(/^C[A-Z2-7]{55}$/);
  });

  it("takes the settings from the environment", () => {
    const net = resolveNetwork(MAINNET);
    expect(net.name).toBe("pubnet");
    expect(net.passphrase).toBe(Networks.PUBLIC);
    expect(net.rpcUrl).toBe("https://rpc.example.com");
    expect(net.factoryId).toBe(FACTORY);
    expect(net.registryId).toBe(REGISTRY);
  });

  it("will not point the build at a test network", () => {
    expect(() => resolveNetwork({ ...MAINNET, EUNOMIA_RPC_URL: "https://soroban-testnet.stellar.org" })).toThrow(/test network/);
    expect(() => resolveNetwork({ ...MAINNET, EUNOMIA_RPC_URL: "https://rpc-futurenet.stellar.org" })).toThrow(/test network/);
  });

  it("refuses a plain-http RPC and a malformed id", () => {
    expect(() => resolveNetwork({ ...MAINNET, EUNOMIA_RPC_URL: "http://rpc.example.com" })).toThrow(/https/);
    expect(() => resolveNetwork({ ...MAINNET, EUNOMIA_FACTORY_ID: "G" + FACTORY.slice(1) })).toThrow(/FACTORY/);
  });

  it("accepts the unit tests' stand-in settings, which point at no real host", () => {
    const net = resolveNetwork(STAND_IN_ENV);
    expect(new URL(net.rpcUrl).hostname.endsWith(".invalid")).toBe(true);
  });
});
