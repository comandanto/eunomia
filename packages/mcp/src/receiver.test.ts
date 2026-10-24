import { test } from "node:test";
import assert from "node:assert/strict";
import { NETWORKS } from "./network.js";
import { assetFromSacName, lacksTrustline } from "./receiver.js";

// Circle's USDC on mainnet.
const ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const PAYEE = "GB4GJNEZ6KLZNU3TE2CHQFNPOEQL5SHPQ246OMRZRLKVVQNLZCDX2QXZ";
const TOKEN = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const NET = { ...NETWORKS.pubnet, rpcUrl: "https://rpc.invalid" };

test("assetFromSacName reads a Stellar Asset Contract's name()", () => {
  assert.ok(assetFromSacName("native")?.isNative());
  const usdc = assetFromSacName(`USDC:${ISSUER}`);
  assert.equal(usdc?.getCode(), "USDC");
  assert.equal(usdc?.getIssuer(), ISSUER);
  assert.equal(assetFromSacName("My Token"), null);
  assert.equal(assetFromSacName(42), null);
});

// A fake RPC: simulateTransaction answers name(), getLedgerEntries answers the trustline read.
function server(name: string, trustlines: number) {
  const calls = { ledger: 0 };
  const s = {
    simulateTransaction: async () => ({
      // rpc.Api.isSimulationSuccess looks for these fields
      transactionData: {},
      events: [],
      minResourceFee: "0",
      _parsed: true,
      latestLedger: 1,
      result: { auth: [], retval: (await import("@stellar/stellar-sdk")).nativeToScVal(name) },
    }),
    getLedgerEntries: async () => {
      calls.ledger++;
      return { entries: Array.from({ length: trustlines }), latestLedger: 1 };
    },
  };
  return { s: s as never, calls };
}

test("a G… payee with no trustline for an issued token is reported", async () => {
  const { s } = server(`USDC:${ISSUER}`, 0);
  assert.equal(await lacksTrustline(NET, TOKEN, PAYEE, s), true);
});

test("contracts, the native token and the issuer itself are never flagged", async () => {
  const { s, calls } = server(`USDC:${ISSUER}`, 0);
  assert.equal(await lacksTrustline(NET, TOKEN, "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", s), false);
  assert.equal(await lacksTrustline(NET, TOKEN, ISSUER, s), false);
  assert.equal(calls.ledger, 0);
});

test("an RPC failure answers false — the contract keeps the final word", async () => {
  const s = {
    simulateTransaction: async () => {
      throw new Error("rpc down");
    },
  } as never;
  assert.equal(await lacksTrustline(NET, "CBADTOKEN", PAYEE, s), false);
});
