// Wallet balance helpers — a fresh wallet has 0 XLM, so the very first workspace action
// (deploying a treasury) would fail with an opaque error. Read what the wallet holds and say
// so before the owner signs. The Horizon read takes an injectable fetch, so it unit-tests.
import { HORIZON_URL, NETWORK_PASSPHRASE, RPC_URL, SIMULATION_SOURCE, XLM_SAC } from "../config";

/** Minimum native balance (XLM) to comfortably deploy, fund, and use a treasury. */
export const MIN_XLM = 20;

/** Native XLM balance of a classic account, or null if the account doesn't exist yet.
 *
 *  Classic accounts only. A smart wallet's XLM lives in the SAC, not in an account record —
 *  asking Horizon for a C-address returns 400, which is what the passkey session was doing on
 *  every load. Callers route those through `getContractXlmBalance`. */
export async function getXlmBalance(
  address: string,
  fetchFn: typeof fetch = fetch,
): Promise<number | null> {
  const res = await fetchFn(`${HORIZON_URL}/accounts/${address}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Horizon error ${res.status} — could not read your wallet balance.`);
  const body = (await res.json()) as { balances?: { asset_type: string; balance: string }[] };
  const native = body.balances?.find((b) => b.asset_type === "native");
  return native ? Number(native.balance) : 0;
}

/** What an address holds of a token, read from the token's SAC by simulation (no signature,
 *  no fee). Works for a classic account and a smart wallet alike. Returns null when the
 *  balance cannot be read at all, matching the classic helper's "unknown" case.
 *
 *  A classic account with no trustline for the token holds none of it, but the SAC does not
 *  say 0: it fails with its TrustlineMissingError (#13). That one failure reads as 0. */
export async function getTokenBalance(sac: string, address: string): Promise<number | null> {
  const { Account, BASE_FEE, Contract, TransactionBuilder, rpc, scValToNative, Address } =
    await import("@stellar/stellar-sdk");

  try {
    const tx = new TransactionBuilder(new Account(SIMULATION_SOURCE, "0"), {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(new Contract(sac).call("balance", new Address(address).toScVal()))
      .setTimeout(30)
      .build();

    const sim = await new rpc.Server(RPC_URL).simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim) && /Error\(Contract,\s*#13\)/.test(sim.error)) return 0;
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result?.retval) return null;
    return Number(scValToNative(sim.result.retval) as bigint) / 10_000_000;
  } catch {
    return null;
  }
}

/** XLM held by a contract account, from the native SAC. */
export function getContractXlmBalance(address: string): Promise<number | null> {
  return getTokenBalance(XLM_SAC, address);
}

/** true when the balance is too low to deploy + fund a treasury. */
export function needsFunding(balance: number | null): boolean {
  return balance === null || balance < MIN_XLM;
}
