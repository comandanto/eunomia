import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRequirement, decodePaymentRequired, selectRequirement, type PaymentRequirements } from "./x402.js";

const XLM = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
const req = (over: Partial<PaymentRequirements> = {}): PaymentRequirements => ({
  scheme: "exact",
  network: "stellar:pubnet",
  amount: "25000000",
  asset: XLM,
  payTo: "GDOMW4C36BUBBFJW3V4L22LUICOUKFVTPGOYU6UMZZ6D3ENEOCH4QCRT",
  maxTimeoutSeconds: 60,
  extra: { areFeesSponsored: true },
  ...over,
});

test("decodePaymentRequired accepts the v2 base64 header and a plain JSON body", () => {
  const body = { x402Version: 2, resource: { url: "http://x/y" }, accepts: [req()] };
  const b64 = Buffer.from(JSON.stringify(body)).toString("base64");
  assert.equal(decodePaymentRequired(b64).accepts[0].payTo, req().payTo);
  assert.equal(decodePaymentRequired(JSON.stringify(body)).x402Version, 2);
  assert.throws(() => decodePaymentRequired(JSON.stringify({ x402Version: 2 })), /accepts/);
});

test("checkRequirement names every mismatch the treasury cannot settle", () => {
  assert.deepEqual(checkRequirement(req(), "pubnet", XLM), []);
  // A seller asking to be paid on a test network is a mismatch like any other.
  const problems = checkRequirement(
    req({ scheme: "upto", network: "stellar:testnet", asset: "CUSDC", amount: "0" }),
    "pubnet",
    XLM,
  );
  assert.equal(problems.length, 4);
  assert.match(problems.join("|"), /scheme/);
  assert.match(problems.join("|"), /network/);
  assert.match(problems.join("|"), /asset/);
  assert.match(problems.join("|"), /amount/);
});

test("selectRequirement picks the first settleable option and explains the rest", () => {
  const usdc = req({ asset: "CUSDC" });
  const out = selectRequirement([usdc, req()], "pubnet", XLM);
  assert.equal(out.req?.asset, XLM);
  assert.equal(out.rejected.length, 1);
  assert.equal(selectRequirement([usdc], "pubnet", XLM).req, null);
});
