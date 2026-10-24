---
name: eunomia-bounded-treasury
description: >
  Use when giving an AI agent a safe, non-custodial spending account on Stellar: deploying a
  bounded treasury (per-payment + rolling daily + monthly limits, payee whitelist and caps),
  issuing time-bound spend-capped agent session keys, escrowing payments to deadlines, gating
  payees by on-chain reputation, wiring x402 payments through a contract-enforced policy, or
  proving that a batch of agent payments complied with policy via a Groth16/BN254
  zero-knowledge proof. Also use when users mention agent spending limits, bounded agents, agent
  treasuries, autonomous payments with guardrails, confidential compliance, or "the wallet an AI
  agent can't drain" — even if they don't mention Eunomia by name (the project was previously
  called PRISM).
license: MIT
compatibility: Designed for Claude Code and compatible AI coding assistants. Building the contracts requires Rust + stellar-cli; the web client and prover run on Node.
metadata:
  author: Bekir Erdem & Seyit Ali Değirmen
  version: "0.6"
---

# Eunomia — Bounded Agent Treasury on Stellar

Eunomia (formerly PRISM) is a non-custodial Soroban treasury that lets an AI agent spend real
money while the **contract** — not the model's good intentions — enforces the policy. Every violation (unknown
payee, over-limit payment, expired session) is rejected **on-chain**. It runs on **Stellar
mainnet, in beta**: every treasury carries a deposit cap fixed at creation.

- Repo: https://github.com/eunomia-finance/eunomia · Live app: https://eunomia.finance
- Deep docs in-repo: `README.md` (product tour), `DEPLOYMENT.md` (deployed contracts and what
  was verified), `SECURITY.md` (audit findings + known limitations), `ROADMAP.md`,
  `docs/TRY-IT.md` (5-minute walkthrough).

## When to reach for Eunomia

1. An agent must pay for APIs/services autonomously, but its blast radius must be capped by contract.
2. You need auditable, task-attributed agent spending (`task_id` accounting, on-chain events).
3. You want x402-style pay-per-call where every payment passes a policy gate before settling.
4. You need to prove policy compliance to a third party **without disclosing** payment details
   (ZK — built and verified, not deployed in the mainnet beta).

## Contracts (Stellar mainnet)

| Contract | Address |
|---|---|
| Treasury factory (one owner signature: deploy + policy + payees + Leash + funding + registry) | set at deploy — `DEPLOYMENT.md` |
| Treasury wasm v4 (what the factory instantiates; deploy your own from this hash) | `c11a5c63e610be259cdcf23d276fdf6f3069fdc6069c4d713b52d556f24238ec` |
| Treasury Registry (cross-device discovery) | set at deploy — `DEPLOYMENT.md` |
| Circle USDC (SAC of `USDC:GA5ZSEJY…KZVN`) — the token of a USDC treasury | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |
| XLM (SAC) — the token of an XLM treasury | `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` |

## Quickstart

**Fastest path:** open https://eunomia.finance → *Create your treasury with a passkey*
(Face ID, a fingerprint or a device PIN — no wallet and no seed phrase: the passkey controls a
Stellar smart wallet and transaction fees are sponsored) → set the limits and *Create treasury*
(one signature; it holds USDC by default) → *Add funds* from your wallet → approve a payee → pay,
or connect an agent (below). Out-of-policy payments are rejected by the contract, visibly.
Browser wallets (Freighter, xBull, Albedo, LOBSTR, Rabet, Hana, or WalletConnect on mobile)
work the same way.

**Connect an agent — `eunomia-mcp` (npm):**

```bash
# on the agent's machine: makes its key, prints it + the MCP config (a mainnet RPC is required)
EUNOMIA_RPC_URL=<mainnet RPC> npx -y eunomia-mcp init --treasury <C…>
# send the printed key ~3 XLM (it pays its own fees), then: npx -y eunomia-mcp trustline
# owner: dashboard → Agent → paste the public key → cap + duration → Authorise agent (one signature)
claude mcp add eunomia -e EUNOMIA_TREASURY=<C…> -e EUNOMIA_RPC_URL=<…> -- npx -y eunomia-mcp
```

Tools: `check_budget` (caps, Leash, free balance, the `unit` amounts are in; with `amount`, the
contract's refusal codes ahead of time) · `list_allowed_payees` · `check_payee` · `pay` (`to` +
`amount`, or an x402 payment requirement in the treasury's asset) · `request_exception` /
`check_exception` (the agent asks; the owner resolves on-chain from the dashboard) ·
`request_budget` · `find_services` / `fund_float` / `call_service` / `sweep_float` (buying x402
services from a bounded float). A refusal is data, not an error:
`{ paid: false, stage, reasons: [{ code, name }], nextStep }`. The dashboard prints the `init`
command with the id filled in — during setup too, because a treasury's address is
`hash(network, factory, salt)` and is known before the treasury exists. Details:
`packages/mcp/README.md`.

**CLI path — deploy your own treasury from the installed wasm (no build needed):**

```bash
stellar contract deploy \
  --wasm-hash c11a5c63e610be259cdcf23d276fdf6f3069fdc6069c4d713b52d556f24238ec \
  --source-account YOU --network mainnet \
  -- --admin G_YOUR_ADDRESS --agent G_AGENT_ADDRESS \
     --token C_SEP41_OR_SAC_TOKEN \
     --daily_limit 500000000 --per_task_limit 100000000 --deposit_cap 1000000000
```

The CLI's `mainnet` alias brings no RPC of its own: pass `--rpc-url` or configure one with
`stellar network add`. `admin` owns the policy; `agent` is the only address allowed to spend (they may be the same
wallet — the live app's non-custodial default). `token` is any SEP-41/SAC contract, fixed for the
treasury's life (the live app offers Circle's USDC or native XLM; amounts are in the token's
smallest unit, 7 decimals for both). `deposit_cap` (0 = uncapped) is fixed for the treasury's
life and binds everything funded through `deposit`. The contract also rejects a policy whose
daily limit exceeds 16 × the per-payment limit — the most one compliance proof can cover.

**Build from source (optional):** `cargo test` then `stellar contract build` in
`contracts/treasury/` — target is `wasm32v1-none`.

## Core contract API (treasury v4, verified signatures)

```rust
__constructor(admin, agent, token, daily_limit, per_task_limit, deposit_cap)  // per_task <= daily, both > 0
// Funding (anyone, from their own address):
deposit(from, amount)                                 // refuses to take the balance over deposit_cap
// Spending (agent — or active session agent — auth):
pay(task_id: u64, to: Address, amount: i128)          // whitelist OR reputation gate + limits
create_escrow(task_id, payee, amount, deadline) -> id // locks funds from free balance
release_escrow(id) / refund_escrow(id)                // deliver vs deadline-passed refund
// Policy management (admin auth):
add_payee(payee) / remove_payee(payee)
set_reputation_policy(registry, min_reputation)       // payee passes if whitelisted OR rep >= min
set_session(agent, valid_until, limit) / revoke_session()  // time-bound, spend-capped credential
set_task_budget(agent, valid_until, limit, payees)    // a session limited to <= 16 named payees
set_monthly_limit(limit) / set_payee_cap(payee, cap)  // per UTC calendar month; 0 removes
set_limits(daily_limit, per_task_limit) / set_agent(agent)
set_paused(true|false) / admin_withdraw(to, amount) / admin_cancel_escrow(id)
// Views: get_config, is_payee, task_spent(task_id), day_spent, balance, locked, get_escrow(id), get_session,
//        session_payees, monthly_limit, month_spent(month), this_month, payee_cap(payee), payee_spent(payee, month),
//        deposit_cap, is_paused, period_spent(period), whitelist_root   // the last two are what a ZK proof binds to
// Factory: create(Setup{owner, token, daily_limit, per_task_limit, monthly_limit, payees, payee_caps,
//                       leash, fund, register, salt}) -> treasury
```

**Error codes:** 1 InvalidAmount · 2 PayeeNotWhitelisted · 3 ExceedsTaskLimit ·
4 ExceedsDailyLimit · 5 BelowReputationThreshold · 6 InsufficientFreeBalance · 7 EscrowNotFound ·
8 DeadlineNotReached · 9 Paused · 10 ExceedsSessionLimit · 11 InvalidLimits · 12 InvalidDeadline ·
14 ExceedsPayeeCap · 15 ExceedsMonthlyLimit · 16 ExceedsDepositCap · 17 PayeeOutsideTaskBudget.
13 is the token contract's `TrustlineMissing`, never the treasury's.

**Registry:** `register(owner, treasury)` / `treasuries_of(owner) -> Vec<Address>` — the app uses
it so a user's treasuries survive browser/device changes.

## Agent sessions (account-abstraction pattern)

`set_session(agent, valid_until, limit)` issues a temporary spender credential. While active
(`now < valid_until`) the session agent **replaces** the root agent as the only spender; when it
expires or `revoke_session()` fires (works even while paused — incident response), spending falls
back to `Config.agent`. The session key is the agent's own, made on its machine by
`eunomia-mcp init`; only its public half reaches the owner.

## x402 integration (`packages/x402`)

`gateX402(paymentRequirements, treasuryPolicy)` checks an x402 payment request against the
treasury policy off-chain; `boundedPay(...)` settles allowed requests through the real on-chain
`pay(...)` via `makeTreasurySettle` (stellar-cli wrapper — the agent key stays in the OS keychain,
never in code). Policy-violating requests are refused before any funds move.

## Confidential compliance (ZK)

Circuit: `circuits/compliance.circom` (Groth16 over **BN254**, Poseidon commitments — matches
Stellar's Protocol 25 "X-Ray" `bn254_multi_pairing_check` host function). One proof attests, for a
batch of up to 16 hidden payments in a closed period: the batch **adds up to exactly the
treasury's own `period_spent`**, every amount ≤ per-task limit, every payee ∈ the published
whitelist Merkle root — without revealing amounts or payees. The on-chain verifier is
**multi-tenant and holds no policy**: `verify(treasury, proof, public)` re-reads limits, payee
root and the period total from the treasury named in the call, accepts only that treasury's
admin, only closed and strictly advancing periods, and rejects non-canonical field encodings. It
attests after the fact (`pay()` does not wait for a proof) and proves the total, not the
breakdown — see `SECURITY.md`. **Not deployed in the mainnet beta:** the trusted setup is a
single-party development setup, and a multi-party ceremony comes first. Prover toolchain:
`circuits/scripts/prove.ts` + `packages/prover` (salt is CSPRNG — never sequential).

## Gotchas (non-obvious facts an agent will get wrong)

- **The daily limit is a rolling 24h window** (v3.1+), not a UTC calendar day. The **monthly**
  budget and payee caps are per UTC calendar month.
- **Escrowed funds are locked:** `pay()` spends only *free* balance (`balance - locked`); a
  compromised agent cannot drain the treasury into escrows either — `admin_cancel_escrow` exists.
- **A session replaces the root agent** while active; it does not add a second spender.
- **SAC recipients that are classic G-accounts need a trustline** for the token first, or the
  transfer fails with `Error(Contract, #13)` — the token's code, not the treasury's. Contract
  (C-address) recipients don't.
- **A deposit's failure codes are the token's too.** `deposit` itself only refuses with 1 or 16;
  a short balance surfaces as the SAC's `#10`, which is *not* `ExceedsSessionLimit`.
- **A bare token transfer to a treasury bypasses the deposit cap.** No contract can refuse an
  incoming SAC transfer; the cap binds `deposit`, which the app and the factory use.
- **Per-task limit must be ≤ daily limit** — the constructor and `set_limits` both panic/err otherwise.
- **Build target is `wasm32v1-none`** (not `wasm32-unknown-unknown`); mainnet contract size cap is 128KB.
- **Soroban `getEvents` scans ~10k ledgers per page** — paginate with the cursor to the head or a
  24h window will silently miss recent events (the app does this).
- **An expired Leash is not an error code.** Its key just stops being the spender, so the call
  fails authorisation; `ExceedsSessionLimit` (#10) is only for the cap.
- **A treasury's address is `hash(network, factory, salt)`** — independent of owner and rules.
  `predictTreasuryId(salt)` in `web/src/lib/createTreasury.ts` computes it offline; that is how
  an agent's key can be made for a treasury before it exists.
- **`eunomia-mcp` amounts are decimal strings; `unit` says of what** (read from the token's
  `symbol()`); `token` is the contract id an x402 requirement's `asset` must equal.
- **`eunomia-mcp` runs on mainnet only and needs `EUNOMIA_RPC_URL`**: there is no public mainnet
  default, and `EUNOMIA_NETWORK`, if set, must be `pubnet`.

## Project structure

```
contracts/   treasury (v4) · treasury_factory · treasury_registry · compliance_verifier · reputation_oracle · policy (OZ hooks)
circuits/    compliance.circom + prove/verify scripts (Groth16/BN254, Poseidon)
packages/    mcp (eunomia-mcp: MCP server + SDK + CLI) · x402 (gate + bounded settle) · prover · generated clients
web/         React app — passkeys + wallet kit, one-signature setup, the decision ledger, Leash; worker/ = the relay
```

## Resources

- Product tour and demo video: `README.md`
- Deployed addresses, wasm hashes and what was verified: `DEPLOYMENT.md`
- Security posture & disclosure: `SECURITY.md`
- Try-it walkthrough: `docs/TRY-IT.md` (EN) · `docs/TRY-IT-TR.md` (TR) · the agent package: `packages/mcp/README.md`
- What changed and when: `CHANGELOG.md` · where it is going: `ROADMAP.md`
