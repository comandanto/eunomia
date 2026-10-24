# Roadmap

Eunomia runs on **Stellar mainnet, in beta**, and is growing into **mainnet agent-payments
infrastructure on Stellar**. Milestones are sequenced, not dated — each unlocks the next,
and each is verifiable on-chain or in the repo.

## M1 — Traction *(shipped, before mainnet)* ✅

Bounded treasury + per-user product + ZK compliance layer · analytics, in-app feedback and
on-chain activity logging (proof of usage) · 10+ real user wallets with on-chain
interactions · published feedback summary.

## M2 — Agent infrastructure *(shipped)* ✅

- **Leash sessions** — time-bound, spend-capped agent keys per treasury, zero-popup
  signing, instant revocation; the only spender while active.
- **Lifecycle** — pause/resume, admin withdraw, live limit updates, agent rotation
  (the contract stays deliberately non-upgradeable).
- **Treasury Registry** — on-chain discovery & recovery by owner wallet.
- **Rolling 24h window** — closed the fixed-UTC-day 2× boundary spend.

## M2.5 — Anyone can start, any agent can connect *(shipped)* ✅

- **Passkey onboarding** — create and run a treasury with Face ID, a fingerprint or a
  device PIN: no wallet to install, no seed phrase. The passkey controls a Stellar smart
  wallet and fees are sponsored, without giving up custody.
- **One-signature setup** — the treasury factory deploys, sets the rules, approves payees,
  starts the Leash, funds and registers, atomically.
- **[`eunomia-mcp`](/connect-your-agent) on npm** — any MCP agent checks its budget, pays,
  settles x402 requirements and asks the owner for exceptions; refusals arrive with the
  contract's own error codes.
- **A SEP-6 fiat ramp, proven** against a sandbox anchor (TRY in, USDC into the treasury,
  and back out) — retired from the app at the mainnet cutover until a production anchor is
  in place.
- **Proofs bound to chain state** and a **third, full-scope security review**.

## M3 — Mainnet beta *(in progress)*

Treasury v4 (monthly budget, payee caps, task budgets, a deposit cap) · a review of the
factory, `eunomia-mcp` and the relay, high and medium findings closed · a relay bounded by
rate limits and a daily fee budget · a mainnet-only app with no keys in the bundle · Circle
**USDC** deposited from the owner's wallet — done. Next: the **mainnet deployment** with the
beta's deposit cap · fee sponsorship for agent accounts · an **external audit** before the cap
goes · a multi-party **trusted-setup ceremony**, then the ZK verifier on mainnet.

## M4 — Ecosystem integrations

Production **ERC-8004 reputation** (trionlabs/stellar-8004), with a lower cap for
reputation-admitted payees · a **production SEP-6 anchor** with SEP-45 · **x402 at scale** —
paying real, USDC-priced agent-facing APIs from a treasury · the agent's refusals in the
owner's decision ledger · agent-platform skills (OpenClaw / ClawHub) on top of
`eunomia-mcp` · ZK compliance wired into the payment flow, composing with OpenZeppelin
Confidential Tokens · more on-ramps: the same SEP-6 client against anchors in other
currencies.

## M5 — Growth & sustainability

50+ active user wallets · revenue model validated with real users (decided by usage
data, not assumption) · ecosystem partnerships formalized.

---

**Where we are:** M1, M2 and M2.5 are shipped; M3 is in progress, and the contracts' mainnet
deployment is the next step. Progress is tracked in the
[commit history](https://github.com/eunomia-finance/eunomia/commits/main) and
[`CHANGELOG.md`](https://github.com/eunomia-finance/eunomia/blob/main/CHANGELOG.md).
