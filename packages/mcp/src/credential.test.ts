import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Keypair } from "@stellar/stellar-sdk";
import {
  createCredential,
  credentialPath,
  isValidContractId,
  loadCredential,
  resolveCredential,
  saveCredential,
} from "./credential.js";

const T = "CBCBYWUMRD7L6GFTRJME232JUAEJ2B263N5O7MDGCMDFG4FI6GJ5JN36";
const tmp = () => mkdtempSync(join(tmpdir(), "eunomia-cred-"));

test("create → save → load round-trips and refuses to overwrite", () => {
  const home = tmp();
  const c = createCredential("pubnet", T);
  assert.equal(c.version, 1);
  assert.equal(Keypair.fromSecret(c.agentSecret).publicKey(), c.agentPublicKey);
  const p = saveCredential(home, c);
  assert.equal(p, credentialPath(home, "pubnet", T));
  assert.deepEqual(loadCredential(home, "pubnet", T), c);
  assert.throws(() => saveCredential(home, createCredential("pubnet", T)), /already exists/);
  const replaced = createCredential("pubnet", T);
  saveCredential(home, replaced, { force: true });
  assert.deepEqual(loadCredential(home, "pubnet", T), replaced);
  if (process.platform !== "win32") assert.equal(statSync(p).mode & 0o777, 0o600);
});

test("createCredential rejects a non-contract id before generating anything", () => {
  assert.throws(() => createCredential("pubnet", "GDPKXL6CNHUXBV4PM54CPTRZNQRYVTIMO4YGBW3M2MNSCMQ7TTNINXP6"), /contract id/);
});

test("env secret wins over the file; nothing configured → null", () => {
  const home = tmp();
  saveCredential(home, createCredential("pubnet", T));
  const kp = Keypair.random();
  const c = resolveCredential({ EUNOMIA_AGENT_SECRET: kp.secret() }, home, "pubnet", T);
  assert.equal(c?.agentPublicKey, kp.publicKey());
  assert.equal(c?.createdAt, "env");
  assert.equal(resolveCredential({}, tmp(), "pubnet", T), null);
  assert.throws(() => resolveCredential({ EUNOMIA_AGENT_SECRET: "SNOTASECRET" }, home, "pubnet", T), /EUNOMIA_AGENT_SECRET/);
});

test("contract id validation", () => {
  assert.equal(isValidContractId(T), true);
  assert.equal(isValidContractId("GDPKXL6CNHUXBV4PM54CPTRZNQRYVTIMO4YGBW3M2MNSCMQ7TTNINXP6"), false);
  assert.equal(isValidContractId("nope"), false);
});
