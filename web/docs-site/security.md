# Security Model

Eunomia runs on Stellar mainnet **in beta**: the code has had internal reviews, not an
external audit, so every treasury carries a deposit cap fixed at creation. Use amounts you
are prepared to lose; see [Roadmap](/roadmap) for what comes before the cap goes.

## The model

- **Non-custodial.** Funds live in the owner's own contract. Eunomia code cannot move value
  outside the on-chain rules; violations are rejected by the contract, on-chain.
- **No front-runnable initialization.** Rules are set atomically in the constructor —
  there is no separate `initialize` to race.
- **Checks-effects-interactions.** Accounting is written before the token transfer; a
  failed transfer reverts the whole call. Soroban additionally forbids host-level
  reentrancy.
- **Overflow-checked arithmetic.** Spend accounting panics (reverts) rather than wrapping.
- **Sponsored fees are not custody.** A passkey user holds no XLM, so someone else pays the
  transaction fee. That account cannot redirect or alter the payment: authorisation is a
  signature from your own passkey, bound to your smart wallet's address, and the contract
  checks it independently of whoever submitted the transaction.
- **Deliberately non-upgradeable.** No upgrade entrypoint — "the rules are enforced"
  never degrades into "trust the admin". Exit = pause → withdraw → fresh treasury.
- **ZK verifier bound to chain state.** The verifier holds no policy of its own: it re-reads
  the limits, the payee root and the period's total from the treasury named in the call, and
  the circuit forces the proved batch to equal that total. Only the treasury's admin can
  attest, periods are closed and strictly advancing, non-canonical encodings are rejected. A
  fabricated batch and a replay were both rejected on chain. (Not deployed in the mainnet
  beta.)
- **One-signature setup gives the factory no standing authority.** It deploys the treasury
  with the owner as admin and performs the setup as sub-invocations of the one call the owner
  signed; afterwards it has no role, holds no funds and cannot act on the treasury.
- **Agent credentials stay on the agent's machine.** `eunomia-mcp` makes the Leash key
  locally; only its public half reaches the app, and what it can do ends when the owner
  revokes it.

## Audit history

Three agent-assisted internal reviews: 2026-06-03 (pre-ZK), 2026-07-07 (fresh eyes, after
M2) and 2026-08-05 (full scope: contracts, data layer, web, CI/CD, supply chain, git
history). **No critical findings, and no path found for a compromised agent key, a
malicious payee or a third party to drain a treasury.** Highlights of what was closed:

| Finding | Closure |
| --- | --- |
| Daily cap reset on UTC calendar day (2× boundary spend) | Rolling 24h window, hourly buckets |
| CEI ordering in `pay()` | Effects recorded before transfer |
| No owner exit if agent key lost | `admin_withdraw` + `set_paused` + `set_agent` |
| Compromised agent could lock funds in escrows | `admin_cancel_escrow` (owner-signed, works while paused) |
| Storage TTL — idle entries could archive | Every mutation auto-extends instance TTL (v3.2) |
| Wallet selection reset to Freighter on reload | Selected wallet persisted |
| Rolling window freed spend after 23h (2× the daily cap reachable) | 25 hourly buckets — never short of 24h |
| A spent proof replayable under `periodId + r` | Every public signal must be canonical |
| ZK attestation not bound to the treasury | Verifier re-reads limits, payee root and period total from chain |
| CI traces could leak the funded test key from a public repo | Traces off on CI; Actions pinned; token scopes reduced |

**Still open** — stated here rather than left to be found: the registry stores an
*unverified* ownership claim (the app refuses any treasury whose on-chain admin is not you;
the contract-side check is open) · activity telemetry is hardened but not yet verified
against the ledger server-side, so treat those numbers as telemetry, not proof · with the
reputation gate on, the registry's controller can admit payees at full limits (needs a
lower cap). Every finding and its status:
[`SECURITY.md`](https://github.com/eunomia-finance/eunomia/blob/main/SECURITY.md).

## Known limitations (honest scope)

- **The agent's key is a file on the agent's machine** — bounded by design (cap + expiry +
  instant revoke), so a leak is survivable, but whoever holds it can spend up to the Leash's
  cap until the owner revokes it.
- **The ZK layer attests after the fact, and proves the total rather than the breakdown** —
  `pay()` does not yet require a proof, and the trusted setup is single-party, which is why
  the verifier is not deployed in the mainnet beta (see [Confidential compliance](/zk)).
- **The reputation oracle is a stand-in** — not deployed on mainnet; production targets the
  stellar-8004 registries.

## Reporting a vulnerability

Preferred: GitHub **private vulnerability reporting** on the repository
(Security → Report a vulnerability), or email **l3ekirerdem@gmail.com**. Reports are
acknowledged as fast as possible; fixes are prioritized ahead of feature work.
